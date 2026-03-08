/**
 * AUDION MCP Server – supports Streamable HTTP (default) or stdio (for Claude Desktop).
 *
 * Env:
 * - MCP_TRANSPORT=stdio  → stdio (Claude Desktop: command + args in config)
 * - MCP_TRANSPORT=http   → Streamable HTTP on MCP_PORT (default 3100)
 * - MCP_STATELESS=true   → stateless HTTP: one JSON-RPC request → one JSON response (no SDK Streamable transport)
 *
 * Always set: AUDION_API_URL, AUDION_API_TOKEN
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerAudionTools } from './tools.js';

const USE_STDIO = process.env.MCP_TRANSPORT === 'stdio';
const PORT = Number(process.env.MCP_PORT) || 3100;
const STATELESS =
  process.env.MCP_STATELESS === 'true' || process.env.MCP_STATELESS === '1';

function log(msg: string): void {
  (USE_STDIO ? process.stderr : process.stdout).write(`[AUDION MCP] ${msg}\n`);
}

async function parseBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw.trim()) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve(undefined);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const raw = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Length', Buffer.byteLength(raw, 'utf8'));
  res.end(raw);
}

function createStatelessMcpServer(): McpServer {
  const server = new McpServer(
    { name: 'audion-mcp', version: '1.0.0' },
    { capabilities: {} }
  );
  registerAudionTools(server);
  return server;
}

async function handleStatelessRequest(
  req: IncomingMessage,
  res: ServerResponse,
  parsedBody: unknown
): Promise<void> {
  const message =
    parsedBody && typeof parsedBody === 'object' && 'method' in parsedBody
      ? parsedBody
      : undefined;
  if (!message || typeof (message as { method?: unknown }).method !== 'string') {
    sendJson(res, 400, {
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: 'Invalid JSON-RPC' },
    });
    return;
  }

  let resolveResponse!: (value: unknown) => void;
  const responsePromise = new Promise<unknown>((resolve) => {
    resolveResponse = resolve;
  });

  const transport = {
    onmessage: null as ((msg: unknown, extra?: unknown) => void) | null,
    send(msg: unknown): Promise<void> {
      resolveResponse(msg);
      return Promise.resolve();
    },
    start(): Promise<void> {
      return Promise.resolve();
    },
    close(): Promise<void> {
      return Promise.resolve();
    },
  };

  const mcpServer = createStatelessMcpServer();
  log('Stateless new server for ' + String((message as { method?: string }).method));
  try {
    await mcpServer.connect(transport as Parameters<McpServer['connect']>[0]);
  } catch (e) {
    log('Stateless connect error: ' + String(e));
    sendJson(res, 500, {
      jsonrpc: '2.0',
      id: (message as { id?: unknown }).id ?? null,
      error: { code: -32603, message: 'Server connect error: ' + String(e) },
    });
    return;
  }

  const baseUrl = `http://localhost:${PORT}`;
  const requestInfo = {
    headers: (req.headers as Record<string, string | string[] | undefined>) ?? {},
    url: new URL(req.url ?? '/', baseUrl),
  };
  try {
    transport.onmessage!(message, { requestInfo });
  } catch (e) {
    log('Stateless onmessage error: ' + String(e));
    sendJson(res, 500, {
      jsonrpc: '2.0',
      id: (message as { id?: unknown }).id ?? null,
      error: { code: -32603, message: 'Server error: ' + String(e) },
    });
    return;
  }

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('MCP response timeout')), 15000)
  );
  let response: unknown;
  try {
    response = await Promise.race([responsePromise, timeout]);
  } catch (e) {
    log('Stateless response error: ' + String(e));
    sendJson(res, 500, {
      jsonrpc: '2.0',
      id: (message as { id?: unknown }).id ?? null,
      error: {
        code: -32603,
        message: String(e instanceof Error ? e.message : e),
      },
    });
    return;
  }

  try {
    const body = JSON.stringify(response);
    log('Stateless sending 200 bodyLen=' + body.length);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Length', Buffer.byteLength(body, 'utf8'));
    res.end(body);
  } catch (e) {
    log('Stateless send error: ' + String(e));
    sendJson(res, 500, {
      jsonrpc: '2.0',
      id: (message as { id?: unknown }).id ?? null,
      error: { code: -32603, message: 'Response serialize error' },
    });
  }
}

async function main() {
  const mcpServer = new McpServer(
    { name: 'audion-mcp', version: '1.0.0' },
    { capabilities: {} }
  );
  registerAudionTools(mcpServer);

  if (USE_STDIO) {
    const transport = new StdioServerTransport(process.stdin, process.stdout);
    await mcpServer.connect(transport);
    if (!process.env.AUDION_API_URL || !process.env.AUDION_API_TOKEN) {
      log(
        'AUDION_API_URL or AUDION_API_TOKEN not set – tools will return configuration errors.'
      );
    }
    log('Running in stdio mode (Claude Desktop).');
    return;
  }

  process.on('unhandledRejection', (reason) => {
    log('Unhandled rejection: ' + String(reason));
  });

  let requestQueue: Promise<void> = Promise.resolve();
  const sharedTransport = STATELESS
    ? null
    : new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: true,
      });

  if (sharedTransport) {
    sharedTransport.onerror = (err) => log('Transport error: ' + String(err));
    await mcpServer.connect(sharedTransport);
  }

  const handleWithTransport = async (
    req: IncomingMessage,
    res: ServerResponse,
    parsedBody: unknown,
    transport: StreamableHTTPServerTransport
  ): Promise<void> => {
    await transport.handleRequest(
      req as Parameters<typeof transport.handleRequest>[0],
      res,
      parsedBody
    );
  };

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    log(`${req.method} ${req.url ?? '/'}`);
    try {
      // GET (any path): health/readiness for proxies; MCP uses POST only
      if (req.method === 'GET') {
        sendJson(res, 200, { status: 'ok', service: 'audion-mcp' });
        return;
      }
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.setHeader('Allow', 'GET, POST');
        res.end();
        return;
      }
      const parsedBody = await parseBody(req);
      const method =
        parsedBody && typeof parsedBody === 'object' && 'method' in parsedBody
          ? String((parsedBody as { method?: unknown }).method)
          : '';
      if (method) log('Body method: ' + method);

      if (STATELESS) {
        requestQueue = requestQueue.then(async () => {
          await handleStatelessRequest(req, res, parsedBody);
        });
        await requestQueue;
      } else {
        await handleWithTransport(req, res, parsedBody, sharedTransport!);
      }
    } catch (err) {
      log('Request error: ' + String(err));
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: {
              code: -32603,
              message: err instanceof Error ? err.message : String(err),
            },
          })
        );
      }
    }
  });

  server.listen(PORT, () => {
    log(`Server listening on port ${PORT} (stateless=${STATELESS})`);
    if (!process.env.AUDION_API_URL || !process.env.AUDION_API_TOKEN) {
      log(
        'AUDION_API_URL or AUDION_API_TOKEN not set – tools will return configuration errors.'
      );
    }
  });

  const shutdown = async () => {
    server.close();
    await mcpServer.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  process.stderr.write('[AUDION MCP] Fatal: ' + String(err) + '\n');
  process.exit(1);
});
