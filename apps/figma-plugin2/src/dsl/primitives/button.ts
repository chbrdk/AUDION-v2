import type { DSLButton } from '../types';
import type { RenderContext } from '../renderer';
import { resolveColor } from '../tokens';
import { ensureFont } from '../fonts';

export async function renderButton(
  node: DSLButton,
  ctx: RenderContext
): Promise<FrameNode> {
  const variant = node.variant ?? 'primary';
  const size = node.size ?? 'md';
  const tokenV = ctx.tokens.button[variant];
  const tokenS = ctx.tokens.button.sizes[size];
  const fillColor = resolveColor(tokenV.fill, ctx.tokens);
  const textColor = resolveColor(tokenV.text, ctx.tokens);
  const radius = tokenV.radius;

  const frame = figma.createFrame();
  frame.name = `Button: ${node.label}`;
  frame.layoutMode = 'HORIZONTAL';
  frame.primaryAxisSizingMode = 'AUTO';
  frame.counterAxisSizingMode = 'AUTO';
  frame.primaryAxisAlignItems = 'CENTER';
  frame.counterAxisAlignItems = 'CENTER';
  frame.paddingLeft = tokenS.paddingH;
  frame.paddingRight = tokenS.paddingH;
  frame.paddingTop = tokenS.paddingV;
  frame.paddingBottom = tokenS.paddingV;
  frame.cornerRadius = radius;
  frame.fills = [
    { type: 'SOLID', color: fillColor, opacity: 1 },
  ];
  if (tokenV.stroke) {
    frame.strokes = [
      { type: 'SOLID', color: resolveColor(tokenV.stroke, ctx.tokens), opacity: 1 },
    ];
    frame.strokeWeight = 1;
  }

  const font = await ensureFont('Inter', 'Regular');
  const text = figma.createText();
  text.characters = node.label;
  text.fontName = font;
  text.fontSize = tokenS.fontSize;
  text.fills = [{ type: 'SOLID', color: textColor, opacity: 1 }];
  frame.appendChild(text);

  frame.resize(frame.width, frame.height);
  return frame;
}
