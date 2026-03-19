import type { DSLIcon } from '../types';
import type { RenderContext } from '../renderer';
import { resolveColor } from '../tokens';
import { ensureFont } from '../fonts';

export async function renderIcon(
  node: DSLIcon,
  ctx: RenderContext
): Promise<FrameNode> {
  const size = node.size ?? 24;
  const frame = figma.createFrame();
  frame.name = `Icon: ${node.name}`;
  frame.resize(size, size);
  frame.layoutMode = 'VERTICAL';
  frame.primaryAxisAlignItems = 'CENTER';
  frame.counterAxisAlignItems = 'CENTER';
  frame.fills = [];

  const font = await ensureFont('Inter', 'Regular');
  const text = figma.createText();
  text.characters = '◆';
  text.fontName = font;
  text.fontSize = size * 0.6;
  text.fills = [
    {
      type: 'SOLID',
      color: node.fill
        ? resolveColor(node.fill, ctx.tokens)
        : { r: 0.2, g: 0.2, b: 0.2 },
      opacity: 1,
    },
  ];
  frame.appendChild(text);
  return frame;
}
