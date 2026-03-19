import type { DSLAvatar } from '../types';
import type { RenderContext } from '../renderer';
import { resolveColor } from '../tokens';
import { ensureFont } from '../fonts';

export async function renderAvatar(
  node: DSLAvatar,
  ctx: RenderContext
): Promise<FrameNode> {
  const size = node.size ?? 48;
  const frame = figma.createFrame();
  frame.name = 'Avatar';
  frame.resize(size, size);
  frame.cornerRadius = 9999;
  frame.layoutMode = 'VERTICAL';
  frame.primaryAxisAlignItems = 'CENTER';
  frame.counterAxisAlignItems = 'CENTER';
  frame.fills = [
    {
      type: 'SOLID',
      color: resolveColor('$primary', ctx.tokens),
      opacity: 0.2,
    },
  ];

  const font = await ensureFont('Inter', 'Semi Bold');
  const text = figma.createText();
  text.characters = (node.initials ?? '?').slice(0, 2).toUpperCase();
  text.fontName = font;
  text.fontSize = size * 0.4;
  text.fills = [
    { type: 'SOLID', color: resolveColor('$primary', ctx.tokens), opacity: 1 },
  ];
  frame.appendChild(text);
  return frame;
}
