import type { TextStyle } from '../types';
import type { ResolvedTokens } from '../tokens';

export function inferTextStyle(
  node: TextNode,
  tokens: ResolvedTokens
): TextStyle {
  const size = typeof node.fontSize === 'number' ? node.fontSize : 16;
  const fontWeight =
    typeof node.fontName === 'symbol'
      ? 'Regular'
      : (node.fontName as FontName).style;

  const typo = tokens.typography;
  const candidates: Array<{ key: TextStyle; size: number }> = [
    { key: 'display', size: (typo.display?.size as number | undefined) ?? 64 },
    { key: 'heading-xl', size: (typo['heading-xl']?.size as number | undefined) ?? 48 },
    { key: 'heading-lg', size: (typo['heading-lg']?.size as number | undefined) ?? 36 },
    { key: 'heading-md', size: (typo['heading-md']?.size as number | undefined) ?? 28 },
    { key: 'heading-sm', size: (typo['heading-sm']?.size as number | undefined) ?? 22 },
    { key: 'body-lg', size: (typo['body-lg']?.size as number | undefined) ?? 18 },
    { key: 'body', size: (typo.body?.size as number | undefined) ?? 16 },
    { key: 'body-sm', size: (typo['body-sm']?.size as number | undefined) ?? 14 },
    { key: 'caption', size: (typo.caption?.size as number | undefined) ?? 12 },
    { key: 'overline', size: (typo.overline?.size as number | undefined) ?? 12 },
  ];

  let best: TextStyle = 'body';
  let bestDelta = Infinity;
  for (const { key, size: s } of candidates) {
    const delta = Math.abs(s - size);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = key;
    }
  }
  return best;
}
