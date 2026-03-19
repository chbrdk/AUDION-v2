import type { DSLBadge } from '../types';
import type { RenderContext } from '../renderer';
import { resolveColor } from '../tokens';
import { ensureFont } from '../fonts';

export async function renderBadge(
  node: DSLBadge,
  ctx: RenderContext
): Promise<FrameNode> {
  const variant = node.variant ?? 'default';
  const colorKey =
    variant === 'success'
      ? 'success'
      : variant === 'warning'
        ? 'warning'
        : variant === 'error'
          ? 'error'
          : variant === 'info'
            ? 'info'
            : 'surface';
  const frame = figma.createFrame();
  frame.name = `Badge: ${node.label}`;
  frame.layoutMode = 'HORIZONTAL';
  frame.primaryAxisSizingMode = 'AUTO';
  frame.counterAxisSizingMode = 'AUTO';
  frame.paddingLeft = 8;
  frame.paddingRight = 8;
  frame.paddingTop = 4;
  frame.paddingBottom = 4;
  frame.cornerRadius = 9999;
  frame.fills = [
    {
      type: 'SOLID',
      color: resolveColor(`$${colorKey}`, ctx.tokens),
      opacity: 1,
    },
  ];
  const font = await ensureFont('Inter', 'Semi Bold');
  const text = figma.createText();
  text.characters = node.label;
  text.fontName = font;
  text.fontSize = 12;
  text.fills = [
    { type: 'SOLID', color: resolveColor('$text.primary', ctx.tokens), opacity: 1 },
  ];
  frame.appendChild(text);
  return frame;
}
