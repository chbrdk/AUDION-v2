import type { DSLSpacer } from '../types';
import type { RenderContext } from '../renderer';

export async function renderSpacer(
  node: DSLSpacer,
  ctx: RenderContext
): Promise<FrameNode> {
  const height = node.height ?? 32;
  const frame = figma.createFrame();
  frame.name = 'Spacer';
  frame.layoutMode = 'VERTICAL';
  frame.primaryAxisSizingMode = 'FIXED';
  frame.counterAxisSizingMode = 'FIXED';
  frame.resize(ctx.parentWidth, height);
  frame.fills = [];
  return frame;
}
