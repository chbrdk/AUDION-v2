import type { DSLSection } from '../types';
import type { RenderContext } from '../renderer';
import { resolveColor } from '../tokens';
import { normalizePadding, mapAlignment, mapJustification } from '../utils';

export async function renderSection(
  node: DSLSection,
  ctx: RenderContext
): Promise<FrameNode> {
  const outer = figma.createFrame();
  outer.name = node.name ?? 'Section';
  outer.layoutMode = node.layout === 'horizontal' ? 'HORIZONTAL' : 'VERTICAL';
  outer.primaryAxisSizingMode = 'AUTO';
  outer.counterAxisSizingMode = 'FIXED';
  outer.resize(ctx.parentWidth, 0);

  outer.counterAxisAlignItems = mapAlignment(node.align ?? 'center');
  if (node.justify) {
    outer.primaryAxisAlignItems = mapJustification(node.justify);
  }

  const [pt, pr, pb, pl] = normalizePadding(node.padding ?? [80, 24]);
  outer.paddingTop = pt;
  outer.paddingRight = pr;
  outer.paddingBottom = pb;
  outer.paddingLeft = pl;
  outer.itemSpacing = node.gap ?? 48;

  if (node.fill) {
    outer.fills = [
      {
        type: 'SOLID',
        color: resolveColor(node.fill, ctx.tokens),
        opacity: 1,
      },
    ];
  } else {
    outer.fills = [];
  }

  if (node.maxWidth != null) {
    const inner = figma.createFrame();
    inner.name = 'Content';
    inner.layoutMode = outer.layoutMode;
    inner.primaryAxisSizingMode = 'AUTO';
    inner.counterAxisSizingMode = 'FIXED';
    inner.resize(Math.min(node.maxWidth, ctx.parentWidth), 0);
    inner.itemSpacing = outer.itemSpacing;
    inner.fills = [];

    await ctx.renderChildren(node.children, inner, {
      parentWidth: node.maxWidth,
    });
    outer.appendChild(inner);
  } else {
    await ctx.renderChildren(node.children, outer);
  }

  return outer;
}
