/**
 * Main DSL renderer: renderNode dispatches to primitives, renderChildren appends to parent.
 */

import type { DSLNode, DSLRoot } from './types';
import type { ResolvedTokens } from './tokens';
import { renderFrame } from './primitives/frame';
import { renderSection } from './primitives/section';
import { renderText } from './primitives/text';
import { renderButton } from './primitives/button';
import { renderImage } from './primitives/image';
import { renderIcon } from './primitives/icon';
import { renderCard } from './primitives/card';
import { renderGrid } from './primitives/grid';
import { renderStack } from './primitives/stack';
import { renderDivider } from './primitives/divider';
import { renderInput } from './primitives/input';
import { renderNavbar } from './primitives/navbar';
import { renderHero } from './primitives/hero';
import { renderFooter } from './primitives/footer';
import { renderBadge } from './primitives/badge';
import { renderAvatar } from './primitives/avatar';
import { renderSpacer } from './primitives/spacer';

export interface RenderContext {
  tokens: ResolvedTokens;
  parentWidth: number;
  fontCache: Set<string>;
  renderChildren: (
    children: DSLNode[] | undefined,
    parent: FrameNode,
    overrides?: Partial<Pick<RenderContext, 'parentWidth'>>
  ) => Promise<void>;
}

export async function renderNode(
  node: DSLNode,
  ctx: RenderContext
): Promise<SceneNode> {
  switch (node.type) {
    case 'frame':
      return renderFrame(node, ctx);
    case 'section':
      return renderSection(node, ctx);
    case 'text':
      return renderText(node, ctx);
    case 'button':
      return renderButton(node, ctx);
    case 'image':
      return renderImage(node, ctx);
    case 'icon':
      return renderIcon(node, ctx);
    case 'card':
      return renderCard(node, ctx);
    case 'grid':
      return renderGrid(node, ctx);
    case 'stack':
      return renderStack(node, ctx);
    case 'divider':
      return renderDivider(node, ctx);
    case 'input':
      return renderInput(node, ctx);
    case 'navbar':
      return renderNavbar(node, ctx);
    case 'hero':
      return renderHero(node, ctx);
    case 'footer':
      return renderFooter(node, ctx);
    case 'badge':
      return renderBadge(node, ctx);
    case 'avatar':
      return renderAvatar(node, ctx);
    case 'spacer':
      return renderSpacer(node, ctx);
    default: {
      const unk = node as { type: string };
      console.warn(`Unknown DSL node type: ${unk.type}`);
      const frame = figma.createFrame();
      frame.name = `Unknown (${unk.type})`;
      return frame;
    }
  }
}

export async function renderChildren(
  children: DSLNode[] | undefined,
  parent: FrameNode,
  ctx: RenderContext,
  overrides?: Partial<Pick<RenderContext, 'parentWidth'>>
): Promise<void> {
  if (!children?.length) return;
  const useCtx: RenderContext = overrides ? { ...ctx, ...overrides } : ctx;
  for (const child of children) {
    const scene = await renderNode(child, useCtx);
    parent.appendChild(scene);
  }
}
