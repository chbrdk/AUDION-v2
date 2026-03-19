import type { DSLHero } from '../types';
import type { RenderContext } from '../renderer';
import { renderSection } from './section';

export async function renderHero(
  node: DSLHero,
  ctx: RenderContext
): Promise<FrameNode> {
  const textColor = node.fill ? '#FFFFFF' : undefined;
  const subheadlineColor = node.fill ? '#FFFFFFCC' : undefined;
  const hasImage = Boolean(node.image);
  const isSplit = hasImage && node.layout !== 'center';

  const headlineNode: import('../types').DSLText = {
    type: 'text',
    content: node.headline,
    style: 'display',
    align: isSplit ? 'left' : 'center',
    fill: textColor,
  };

  const children: import('../types').DSLNode[] = [headlineNode];

  if (node.subheadline) {
    children.push({
      type: 'text',
      content: node.subheadline,
      style: 'body-lg',
      align: isSplit ? 'left' : 'center',
      maxWidth: 640,
      fill: subheadlineColor,
    });
  }

  if (node.cta || node.ctaSecondary) {
    const buttonRow: import('../types').DSLStack = {
      type: 'stack',
      layout: 'horizontal',
      gap: 16,
      align: 'center',
      children: [],
    };
    if (node.cta) {
      buttonRow.children!.push({
        type: 'button',
        label: node.cta,
        variant: 'primary',
        size: 'lg',
      });
    }
    if (node.ctaSecondary) {
      buttonRow.children!.push({
        type: 'button',
        label: node.ctaSecondary,
        variant: 'outline',
        size: 'lg',
      });
    }
    children.push(buttonRow);
  }

  if (isSplit) {
    const textStack: import('../types').DSLStack = {
      type: 'stack',
      layout: 'vertical',
      gap: 24,
      align: 'start',
      children,
    };
    const imageNode: import('../types').DSLImage = {
      type: 'image',
      src: node.image,
      alt: 'Hero',
      width: 'fill',
      height: 420,
      fit: 'cover',
      cornerRadius: 8,
    };
    const twoCol: import('../types').DSLGrid = {
      type: 'grid',
      columns: 2,
      gap: 48,
      children: [textStack, imageNode],
    };
    const sectionNode: import('../types').DSLSection = {
      type: 'section',
      name: 'Hero',
      layout: 'vertical',
      align: 'center',
      padding: [80, 24],
      gap: 48,
      fill: node.fill,
      children: [twoCol],
    };
    return renderSection(sectionNode, ctx);
  }

  if (hasImage) {
    children.push({
      type: 'image',
      src: node.image,
      alt: 'Hero',
      width: 'fill',
      height: 360,
      fit: 'cover',
      cornerRadius: 8,
    } as import('../types').DSLImage);
  }

  const sectionNode: import('../types').DSLSection = {
    type: 'section',
    name: 'Hero',
    layout: 'vertical',
    align: 'center',
    padding: [120, 24],
    gap: 24,
    fill: node.fill,
    children,
  };

  return renderSection(sectionNode, ctx);
}
