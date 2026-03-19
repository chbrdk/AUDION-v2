import type { DSLFrame } from '../types';
import type { RenderContext } from '../renderer';
import { resolveColor } from '../tokens';
import { normalizePadding, mapAlignment, mapJustification } from '../utils';

export async function renderFrame(
  node: DSLFrame,
  ctx: RenderContext
): Promise<FrameNode> {
  const frame = figma.createFrame();
  frame.name = node.name ?? 'Frame';

  const layout = node.layout ?? 'vertical';
  frame.layoutMode =
    layout === 'horizontal'
      ? 'HORIZONTAL'
      : layout === 'vertical'
        ? 'VERTICAL'
        : 'NONE';

  const parentW = ctx.parentWidth;
  const width =
    node.width === 'fill' || node.width === undefined
      ? parentW
      : node.width === 'hug'
        ? 100
        : node.width;
  const hasExplicitHeight = node.height != null && node.height !== 'hug';
  const height =
    node.height === 'fill'
      ? 200
      : node.height === 'hug' || node.height === undefined
        ? 0
        : node.height;

  frame.resize(typeof width === 'number' ? width : parentW, typeof height === 'number' ? height : 0);

  if (layout !== 'none') {
    frame.primaryAxisSizingMode = node.width === 'hug' ? 'AUTO' : 'FIXED';
    frame.counterAxisSizingMode =
      node.height === 'hug' || (!hasExplicitHeight && node.children?.length)
        ? 'AUTO'
        : 'FIXED';
    if (node.align) frame.counterAxisAlignItems = mapAlignment(node.align);
    if (node.justify) frame.primaryAxisAlignItems = mapJustification(node.justify);
    frame.itemSpacing = node.gap ?? 0;
    const [pt, pr, pb, pl] = normalizePadding(node.padding ?? 0);
    frame.paddingTop = pt;
    frame.paddingRight = pr;
    frame.paddingBottom = pb;
    frame.paddingLeft = pl;
  }

  if (node.fill) {
    frame.fills = [
      {
        type: 'SOLID',
        color: resolveColor(node.fill, ctx.tokens),
        opacity: 1,
      },
    ];
  }
  if (node.stroke) {
    frame.strokes = [
      {
        type: 'SOLID',
        color: resolveColor(node.stroke.color, ctx.tokens),
        opacity: 1,
      },
    ];
    frame.strokeWeight = node.stroke.width ?? 1;
  }
  if (node.cornerRadius != null) {
    const r = Array.isArray(node.cornerRadius)
      ? node.cornerRadius[0]
      : node.cornerRadius;
    frame.cornerRadius = r;
  }
  if (node.opacity != null) frame.opacity = node.opacity;
  if (node.clip) frame.clipsContent = true;

  if (node.children?.length) {
    await ctx.renderChildren(node.children, frame, {
      parentWidth: typeof width === 'number' ? width : parentW,
    });
  }

  return frame;
}
