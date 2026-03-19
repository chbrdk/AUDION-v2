import type { DSLGrid } from '../types';
import type { RenderContext } from '../renderer';

export async function renderGrid(
  node: DSLGrid,
  ctx: RenderContext
): Promise<FrameNode> {
  const cols = Math.min(6, Math.max(1, node.columns));
  const gap = node.gap ?? 24;

  const frame = figma.createFrame();
  frame.name = 'Grid';
  frame.layoutMode = 'HORIZONTAL';
  frame.primaryAxisSizingMode = 'FIXED';
  frame.counterAxisSizingMode = 'AUTO';
  frame.resize(ctx.parentWidth, 0);
  frame.itemSpacing = gap;
  frame.counterAxisAlignItems = 'CENTER';
  frame.layoutWrap = 'WRAP';

  const childWidth = (ctx.parentWidth - gap * (cols - 1)) / cols;
  const childCtx: RenderContext = { ...ctx, parentWidth: childWidth };
  await ctx.renderChildren(node.children, frame);
  return frame;
}
