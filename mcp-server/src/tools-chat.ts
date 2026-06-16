import { z } from 'zod';
import { chatFetch, isChatApiConfigured, isChatFetchError } from './chat-client.js';

type ToolServer = {
  registerTool: (
    name: string,
    config: {
      title?: string;
      description?: string;
      inputSchema?: z.ZodTypeAny;
    },
    cb: (args: unknown) => Promise<{ content: Array<{ type: 'text'; text: string }> }>
  ) => void;
};

function textResult(value: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

function chatNotConfigured() {
  return textResult({
    error: true,
    message:
      'Chat API not configured. Set CHAT_API_URL (e.g. http://audion-chat-api:8001) and AUDION_API_TOKEN on the MCP container.',
  });
}

export function registerChatTools(server: ToolServer): void {
  if (!isChatApiConfigured()) {
    server.registerTool(
      'audion.chat_status',
      {
        title: 'Chat API status',
        description: 'Reports whether CHAT_API_URL is configured for persona chat tools.',
        inputSchema: z.object({}),
      },
      async () => chatNotConfigured()
    );
    return;
  }

  server.registerTool(
    'audion.chat_health',
    {
      title: 'Chat API health',
      description: 'GET /health on the chat-api service.',
      inputSchema: z.object({}),
    },
    async () => {
      const res = await chatFetch('/health/');
      if (isChatFetchError(res)) return textResult(res);
      return textResult(res);
    }
  );

  server.registerTool(
    'audion.chat_message',
    {
      title: 'Persona chat message',
      description:
        'POST /chat/message – buffered persona chat (use instead of WebSocket for MCP/agents).',
      inputSchema: z.object({
        persona_id: z.string(),
        message: z.string().optional(),
        messages: z
          .array(
            z.object({
              role: z.string(),
              content: z.string(),
              image_ids: z.array(z.string()).optional(),
              document_ids: z.array(z.string()).optional(),
            })
          )
          .optional(),
        user_id: z.string().optional(),
        session_id: z.string().optional(),
        locale: z.string().optional(),
      }),
    },
    async (args) => {
      const body = args as Record<string, unknown>;
      const res = await chatFetch('/chat/message', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (isChatFetchError(res)) return textResult(res);
      return textResult(res);
    }
  );

  server.registerTool(
    'audion.chat_tool_call_decision',
    {
      title: 'Persona chat tool-call decision',
      description: 'POST /chat/tool-call/decision/{call_id} – approve or reject persona tool use.',
      inputSchema: z.object({
        call_id: z.string(),
        body: z.record(z.unknown()),
      }),
    },
    async (args) => {
      const { call_id, body } = args as { call_id: string; body: Record<string, unknown> };
      const res = await chatFetch(`/chat/tool-call/decision/${encodeURIComponent(call_id)}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (isChatFetchError(res)) return textResult(res);
      return textResult(res ?? { success: true });
    }
  );

  server.registerTool(
    'audion.chat_history_upsert',
    {
      title: 'Upsert chat conversation',
      description: 'POST /chat/history/conversations/upsert',
      inputSchema: z.object({
        conversation_id: z.string(),
        persona_id: z.string(),
        persona_name: z.string().optional(),
        title: z.string().optional(),
        metadata: z.record(z.unknown()).optional(),
      }),
    },
    async (args) => {
      const res = await chatFetch('/chat/history/conversations/upsert', {
        method: 'POST',
        body: JSON.stringify(args),
      });
      if (isChatFetchError(res)) return textResult(res);
      return textResult(res);
    }
  );

  server.registerTool(
    'audion.chat_history_append_message',
    {
      title: 'Append chat history message',
      description: 'POST /chat/history/conversations/{conversation_id}/messages',
      inputSchema: z.object({
        conversation_id: z.string(),
        role: z.string(),
        content: z.string(),
        extra: z.record(z.unknown()).optional(),
        persona_id: z.string().optional(),
        persona_name: z.string().optional(),
        title: z.string().optional(),
      }),
    },
    async (args) => {
      const { conversation_id, ...body } = args as {
        conversation_id: string;
        role: string;
        content: string;
        extra?: Record<string, unknown>;
        persona_id?: string;
        persona_name?: string;
        title?: string;
      };
      const res = await chatFetch(
        `/chat/history/conversations/${encodeURIComponent(conversation_id)}/messages`,
        { method: 'POST', body: JSON.stringify(body) }
      );
      if (isChatFetchError(res)) return textResult(res);
      return textResult(res);
    }
  );
}
