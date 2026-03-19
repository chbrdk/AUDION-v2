import type { DSLStack } from '../types';
import type { RenderContext } from '../renderer';
import { renderChildren } from '../renderer';
import { mapAlignment, mapJustification } from '../utils';

export async function renderStack(
  node: DSLStack,
  ctx: RenderContext
): Promise<FrameNode> {
  const frame = figma.createFrame();
  frame.name = 'Stack';
  frame.layoutMode = node.layout === 'horizontal' ? 'HORIZONTAL' : 'VERTICAL';
  frame.primaryAxisSizingMode = 'AUTO';
  frame.counterAxisSizingMode = 'FIXED';
  frame.resize(ctx.parentWidth, 0);
  frame.itemSpacing = node.gap ?? 16;
  if (node.align) frame.counterAxisAlignItems = mapAlignment(node.align);
  if (node.justify) frame.primaryAxisAlignItems = mapJustification(node.justify);
  if (node.wrap) frame.layoutWrap = 'WRAP';
  frame.fills = [];

  await ctx.renderChildren(node.children, frame);
  return frame;
}
