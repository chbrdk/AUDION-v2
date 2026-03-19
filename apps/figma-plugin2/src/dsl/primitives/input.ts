import type { DSLInput } from '../types';
import type { RenderContext } from '../renderer';
import { resolveColor } from '../tokens';
import { ensureFont } from '../fonts';

export async function renderInput(
  node: DSLInput,
  ctx: RenderContext
): Promise<FrameNode> {
  const width = node.width === 'fill' || node.width == null ? ctx.parentWidth : node.width;
  const frame = figma.createFrame();
  frame.name = 'Input';
  frame.layoutMode = 'VERTICAL';
  frame.primaryAxisSizingMode = 'AUTO';
  frame.counterAxisSizingMode = 'FIXED';
  frame.resize(width, 80);
  frame.itemSpacing = 4;
  frame.fills = [];
  const font = await ensureFont('Inter', 'Regular');

  if (node.label) {
    const label = figma.createText();
    label.characters = node.label;
    label.fontName = font;
    label.fontSize = 12;
    label.fills = [
      {
        type: 'SOLID',
        color: resolveColor('$text.secondary', ctx.tokens),
        opacity: 1,
      },
    ];
    frame.appendChild(label);
  }

  const inputRect = figma.createFrame();
  inputRect.name = 'Input field';
  inputRect.resize(width, 40);
  inputRect.cornerRadius = 8;
  inputRect.fills = [
    {
      type: 'SOLID',
      color: resolveColor('$border', ctx.tokens),
      opacity: 0.3,
    },
  ];
  const placeholder = figma.createText();
  placeholder.characters = node.placeholder ?? '';
  placeholder.fontName = font;
  placeholder.fontSize = 14;
  placeholder.fills = [
    { type: 'SOLID', color: resolveColor('$text.tertiary', ctx.tokens), opacity: 1 },
  ];
  inputRect.appendChild(placeholder);
  inputRect.layoutMode = 'VERTICAL';
  inputRect.paddingLeft = 12;
  inputRect.paddingRight = 12;
  inputRect.paddingTop = 8;
  inputRect.paddingBottom = 8;
  inputRect.primaryAxisAlignItems = 'CENTER';
  inputRect.counterAxisAlignItems = 'MIN';
  frame.appendChild(inputRect);
  return frame;
}
