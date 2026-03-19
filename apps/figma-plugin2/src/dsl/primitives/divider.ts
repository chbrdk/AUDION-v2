import type { DSLDivider } from '../types';
import type { RenderContext } from '../renderer';
import { resolveColor } from '../tokens';

export async function renderDivider(
  node: DSLDivider,
  ctx: RenderContext
): Promise<FrameNode> {
  const thickness = node.thickness ?? 1;
  const color = resolveColor(node.color ?? '#E5E7EB', ctx.tokens);

  const frame = figma.createFrame();
  frame.name = 'Divider';
  frame.layoutMode = 'VERTICAL';
  frame.primaryAxisSizingMode = 'FIXED';
  frame.counterAxisSizingMode = 'FIXED';
  frame.resize(ctx.parentWidth, thickness);
  frame.fills = [{ type: 'SOLID', color, opacity: 1 }];
  return frame;
}
