# AUDION MCP Server

## Purpose

The AUDION MCP server exposes AUDION FastAPI APIs as MCP tools so that clients (Cursor, Claude Desktop, etc.) can call the API via the Model Context Protocol. The server is stateless and does not store user data; it forwards requests to the AUDION API with a single Bearer token (`AUDION_API_TOKEN`).

## Architecture

- **Client** (Cursor / Claude) → **MCP Server** (Node, port 3100) → **AUDION FastAPI API** (port 8000).
- Authentication: one **API token** per user, created in AUDION (Settings → API access or `POST /auth/tokens`). Same token is used for MCP and other integrations.
- Optional: **Next.js** rewrites `/mcp` and `/mcp/*` to the MCP server so clients can use `https://audion.example.com/mcp` on the same domain.

## Environment variables

| Variable | Where | Description |
|----------|--------|-------------|
| `AUDION_API_URL` | MCP server | Base URL of the FastAPI API (e.g. `http://api:8000`). |
| `AUDION_API_TOKEN` | MCP server | Bearer token (API token from Settings). |
| `MCP_TRANSPORT` | MCP server | `stdio` for Claude Desktop; omit or `http` for HTTP. |
| `MCP_PORT` | MCP server | HTTP port (default 3100). |
| `MCP_STATELESS` | MCP server | `true` when behind Next.js proxy (recommended). |
| `MCP_SERVER_URL` | **Web app** (Next.js) | Internal URL of the MCP server for rewrites (e.g. `http://audion-mcp:3100`). |

See [audion-urls-and-paths.md](./audion-urls-and-paths.md) for the full list.

## Local run

```bash
cd mcp-server
npm install && npm run build
export AUDION_API_URL=http://localhost:8000
export AUDION_API_TOKEN=audion_xxxx
npm start
```

## Docker / Coolify

- Build from repo root: `docker build -f Dockerfile.mcp-server -t audion-mcp .`
- Run with `AUDION_API_URL` and `AUDION_API_TOKEN`.
- In Coolify: use Dockerfile path `Dockerfile.mcp-server`, context = repo root.

## Same-domain proxy (Next.js)

Set `MCP_SERVER_URL` in the **web app** (e.g. `http://audion-mcp:3100`). The Next.js config rewrites `/mcp` and `/mcp/:path*` to that URL. Clients then use `https://audion.example.com/mcp` (or with base path). Use `MCP_STATELESS=true` on the MCP server to avoid session ID issues behind the proxy.

## Troubleshooting

- **500 when calling /mcp**: Enable `MCP_STATELESS=true`; ensure `MCP_SERVER_URL` points to the MCP service.
- **Tools return "AUDION_API_URL or AUDION_API_TOKEN not configured"**: Set both in the MCP server environment.
- **401 from API**: Token invalid or revoked; create a new token in Settings → API access.
