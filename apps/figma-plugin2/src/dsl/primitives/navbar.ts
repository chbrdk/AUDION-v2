import type { DSLNavbar } from '../types';
import type { RenderContext } from '../renderer';
import { renderSection } from './section';

export async function renderNavbar(
  node: DSLNavbar,
  ctx: RenderContext
): Promise<FrameNode> {
  const sectionNode: import('../types').DSLSection = {
    type: 'section',
    name: 'Navbar',
    layout: 'horizontal',
    padding: [16, 24],
    gap: 24,
    fill: node.fill ?? '#FFFFFF',
    align: 'center',
    justify: 'space-between',
    children: [],
  };

  if (node.logo) {
    sectionNode.children!.push({
      type: 'text',
      content: node.logo,
      style: 'heading-sm',
    });
  }

  if (node.links?.length) {
    const linksStack: import('../types').DSLStack = {
      type: 'stack',
      layout: 'horizontal',
      gap: 24,
      children: node.links.map((label) => ({
        type: 'text',
        content: label,
        style: 'body',
      })),
    };
    sectionNode.children!.push(linksStack);
  }

  if (node.cta) {
    sectionNode.children!.push({
      type: 'button',
      label: node.cta,
      variant: 'primary',
      size: 'md',
    });
  }

  return renderSection(sectionNode, ctx);
}
