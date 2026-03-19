import type { DSLCard } from '../types';
import type { RenderContext } from '../renderer';
import { resolveColor } from '../tokens';
import { normalizePadding } from '../utils';

export async function renderCard(
  node: DSLCard,
  ctx: RenderContext
): Promise<FrameNode> {
  const frame = figma.createFrame();
  frame.name = 'Card';
  frame.layoutMode = 'VERTICAL';
  frame.primaryAxisSizingMode = 'AUTO';
  frame.counterAxisSizingMode = 'FIXED';
  frame.resize(ctx.parentWidth, 0);
  frame.cornerRadius = node.cornerRadius ?? 12;
  const [pt, pr, pb, pl] = normalizePadding(node.padding ?? 24);
  frame.paddingTop = pt;
  frame.paddingRight = pr;
  frame.paddingBottom = pb;
  frame.paddingLeft = pl;
  frame.itemSpacing = node.gap ?? 16;
  frame.fills = [
    {
      type: 'SOLID',
      color: resolveColor(node.fill ?? '#FFFFFF', ctx.tokens),
      opacity: 1,
    },
  ];
  if (node.stroke) {
    frame.strokes = [
      {
        type: 'SOLID',
        color: resolveColor(node.stroke.color, ctx.tokens),
        opacity: 1,
      },
    ];
    frame.strokeWeight = node.stroke.width ?? 1;
  } else {
    frame.strokes = [
      {
        type: 'SOLID',
        color: resolveColor('#E5E7EB', ctx.tokens),
        opacity: 1,
      },
    ];
    frame.strokeWeight = 1;
  }
  frame.effects = [
    {
      type: 'DROP_SHADOW',
      color: { r: 0, g: 0, b: 0, a: 0.06 },
      offset: { x: 0, y: 2 },
      radius: 8,
      spread: 0,
      visible: true,
      blendMode: 'NORMAL',
    },
  ];

  await ctx.renderChildren(node.children, frame);
  return frame;
}
