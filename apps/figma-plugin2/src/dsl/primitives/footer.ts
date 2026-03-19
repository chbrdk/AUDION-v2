import type { DSLFooter } from '../types';
import type { RenderContext } from '../renderer';
import { renderSection } from './section';

export async function renderFooter(
  node: DSLFooter,
  ctx: RenderContext
): Promise<FrameNode> {
  const children: import('../types').DSLNode[] = [];

  if (node.columns?.length) {
    const colsStack: import('../types').DSLStack = {
      type: 'stack',
      layout: 'horizontal',
      gap: 48,
      align: 'start',
      children: node.columns.map((col) => ({
        type: 'stack' as const,
        layout: 'vertical' as const,
        gap: 12,
        children: [
          {
            type: 'text' as const,
            content: col.title,
            style: 'overline' as const,
            fill: node.textColor,
          },
          ...col.links.map((link) => ({
            type: 'text' as const,
            content: link,
            style: 'body-sm' as const,
            fill: node.textColor,
          })),
        ],
      })),
    };
    children.push(colsStack);
  }

  if (node.copyright) {
    children.push({
      type: 'text' as const,
      content: node.copyright,
      style: 'caption' as const,
      fill: node.textColor ?? '#9CA3AF',
    });
  }

  const sectionNode: import('../types').DSLSection = {
    type: 'section',
    name: 'Footer',
    layout: 'vertical',
    padding: [48, 24],
    gap: 24,
    fill: node.fill ?? '#111827',
    align: 'center',
    children,
  };

  return renderSection(sectionNode, ctx);
}
