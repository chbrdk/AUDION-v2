/**
 * Normalize reasoning / step-meta text coming from the UX Journey Agent.
 *
 * The agent extracts fields from a flattened Python repr like
 *   thinking='Ich kann sehen:\nDas ist ...' evaluation_previous_goal='...'
 * where `\n` is the **two-character escape sequence** (backslash + n), not a
 * real line break. When we send this to the frontend it shows up literally as
 * `\n` in the rendered text. We undo the most common escapes here so the text
 * can be rendered correctly (and processed by Markdown).
 */
export function normalizeReasoningText(input: string | null | undefined): string {
  if (!input) {
    return "";
  }
  return input
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, "\\")
    .trim();
}

/**
 * Convenience wrapper: normalize first, then truncate (so we don't cut a string
 * in the middle of an escape sequence).
 */
export function normalizeAndTruncate(
  input: string | null | undefined,
  maxLength: number,
): string {
  const normalized = normalizeReasoningText(input);
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength)}…`;
}
