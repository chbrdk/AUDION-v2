/**
 * RAG Refinement Agent – improves an already-rendered RAG composition.
 * Scans the structure, sends to OpenAI with refinement tools, executes tool calls.
 */

import { RAG_REFINEMENT_TOOLS } from './rag-refinement-tools';
import {
  executeRagRefinementTool,
  executeScanComposedStructure,
  type RagRefinementToolName,
} from './rag-refinement-execute';

const RAG_REFINEMENT_SYSTEM_PROMPT = `You are a layout refinement specialist. A RAG composition has been rendered in Figma. Your job is to improve spacing, alignment, and proportions for a more professional appearance.

You receive the current structure (nodes, bounds, layout, padding, gap). Section names may include [hero], [features], [cta], [footer], [content]—use these for type-specific rules:

**Type-based rules (by section name):**
- [hero]: padding 96–128 vertical, 80–120 lateral; align center; gap 24–32.
- [features]: gap 32–48; setSectionMaxWidth 1200–1440; padding 64–96.
- [cta]: maxWidth ~600; align center; padding 48–64.
- [footer]: distributeSpacing (space-between); padding 24–32; layout horizontal.
- [content]: setSectionMaxWidth 720 for readability.

Use the tools to:
1. Adjust section padding for better breathing room (8px grid: 32, 48, 64, 96).
2. Set consistent gaps between sections and within sections.
3. Center content where appropriate (align: center for hero, CTA).
4. Apply sensible maxWidth (setMaxWidth/setSectionMaxWidth).
5. Use distributeSpacing for footers or headers with multiple elements.
6. setFill, setCornerRadius, reorderChildren when helpful.

Rules:
- Use ONLY the node IDs from the scan. Do not invent IDs.
- Apply 8px grid for all values (8, 16, 24, 32, 48, 64, 96).
- Prefer generous whitespace over cramped layouts.
- When done, reply with a short summary. Typically 3–10 tool calls total.`;

export interface RunRagRefinementAgentOptions {
  fetch: (url: string, opts: { method: string; headers: Record<string, string>; body: string }) => Promise<Response>;
  apiKey: string;
  model: string;
  rootId: string;
  maxSteps?: number;
  refinementRounds?: number;
  requestTimeoutMs?: number;
  onProgress?: (message: string) => void;
  onDebug?: (tool: string, args: Record<string, unknown>, result: unknown) => void;
}

export type RunRagRefinementAgentResult =
  | { success: true }
  | { success: false; error: string };

type ChatMessage =
  | { role: 'system' | 'user' | 'assistant'; content: string }
  | {
      role: 'assistant';
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
      }>;
    }
  | { role: 'tool'; tool_call_id: string; content: string };

function parseToolArgs(argsJson: string): Record<string, unknown> {
  try {
    return JSON.parse(argsJson) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function runRagRefinementAgent(
  options: RunRagRefinementAgentOptions
): Promise<RunRagRefinementAgentResult> {
  const {
    fetch: doFetch,
    apiKey,
    model,
    rootId,
    maxSteps = 10,
    refinementRounds = 2,
    requestTimeoutMs = 30000,
    onProgress,
    onDebug,
  } = options;

  function addStructureMessage(messages: ChatMessage[], round: number): void {
    const scanResult = executeScanComposedStructure(rootId);
    if (!scanResult.success || !scanResult.structure) return;
    const structureStr = JSON.stringify(scanResult.structure, null, 2);
    const label = round === 1
      ? "Here is the current structure of the rendered composition. Optimize spacing, alignment, and layout for a professional result. Use the tools to apply changes."
      : "After previous changes, here is the updated structure. Apply further refinements if needed.";
    messages.push({
      role: 'user',
      content: `${label}\n\nStructure:\n${structureStr}`,
    });
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: RAG_REFINEMENT_SYSTEM_PROMPT },
  ];
  addStructureMessage(messages, 1);

  let step = 0;
  let round = 1;
  const timeout = <T>(p: Promise<T>, ms: number, msg: string) =>
    Promise.race([
      p,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(msg)), ms)
      ),
    ]);

  while (step < maxSteps) {
    step++;
    onProgress?.(`Refinement (Schritt ${step})…`);

    const body = JSON.stringify({
      model,
      messages,
      tools: RAG_REFINEMENT_TOOLS,
      tool_choice: 'auto',
    });

    let res: Response;
    try {
      res = await timeout(
        doFetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body,
        }),
        requestTimeoutMs,
        'OpenAI request timeout'
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, error: msg };
    }

    if (!res.ok) {
      const errText = await res.text();
      let detail = errText.slice(0, 300);
      try {
        const errJson = JSON.parse(errText);
        if (errJson.error?.message) detail = errJson.error.message;
      } catch (_) {}
      return { success: false, error: `OpenAI ${res.status}: ${detail}` };
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    const message = choice?.message;
    if (!message) {
      return { success: false, error: 'OpenAI response had no message' };
    }

    const assistantContent =
      typeof message.content === 'string' ? message.content : message.content ?? null;
    const toolCalls = message.tool_calls;

    messages.push({
      role: 'assistant',
      content: assistantContent,
      ...(toolCalls?.length ? { tool_calls: toolCalls } : {}),
    } as ChatMessage);

    if (!toolCalls || toolCalls.length === 0) {
      if (round >= refinementRounds) return { success: true };
      round++;
      onProgress?.(`Runde ${round}: Erneut scannen…`);
      addStructureMessage(messages, round);
      continue;
    }

    onProgress?.(`Führe ${toolCalls.length} Tool(s) aus…`);

    for (const tc of toolCalls) {
      const id = tc.id;
      const name = tc.function?.name as RagRefinementToolName | undefined;
      const args = parseToolArgs(tc.function?.arguments ?? '{}');

      if (!name || !RAG_REFINEMENT_TOOLS.some((t) => t.function.name === name)) {
        messages.push({
          role: 'tool',
          tool_call_id: id,
          content: JSON.stringify({ success: false, error: `Unknown tool: ${name}` }),
        });
        continue;
      }

      if (name === 'scanComposedStructure') {
        args.rootId = rootId;
      }

      const result = executeRagRefinementTool(name, args);
      const content = result.success
        ? (result.result != null ? JSON.stringify(result.result) : '{"success":true}')
        : JSON.stringify({ success: false, error: result.error });

      onDebug?.(name, args, result.success ? result.result : result.error);
      messages.push({ role: 'tool', tool_call_id: id, content });
    }
  }

  return { success: true };
}
