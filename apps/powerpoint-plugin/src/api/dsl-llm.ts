/**
 * Call OpenAI from the UI to get DSL JSON from a natural language prompt.
 * Used only in the browser (plugin UI iframe).
 */

import { buildDSLSystemPrompt } from '../dsl/systemPrompt';

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

export async function generateDSLFromPrompt(
  apiKey: string,
  userPrompt: string,
  widthPx: number = 1440
): Promise<string> {
  const systemPrompt = buildDSLSystemPrompt(widthPx);
  const res = await fetch(OPENAI_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    const msg = (err as { error?: { message?: string } }).error?.message ?? res.statusText;
    throw new Error(msg);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('Empty response from OpenAI');
  return content;
}
