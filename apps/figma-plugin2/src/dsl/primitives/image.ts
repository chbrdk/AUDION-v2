import type { DSLImage } from '../types';
import type { RenderContext } from '../renderer';
import { ensureFont } from '../fonts';

function truncateUrl(url: string, maxLen: number): string {
  if (url.length <= maxLen) return url;
  try {
    const u = new URL(url);
    const path = u.pathname.split('/').pop() || u.hostname;
    return path.length > maxLen ? path.slice(0, maxLen - 2) + '…' : path;
  } catch {
    return url.slice(0, maxLen - 2) + '…';
  }
}

export async function renderImage(
  node: DSLImage,
  ctx: RenderContext
): Promise<FrameNode> {
  const width =
    node.width === 'fill' || node.width == null
      ? ctx.parentWidth
      : node.width;
  const height = node.height ?? 300;

  const frame = figma.createFrame();
  frame.name = node.alt ?? 'Image';
  frame.resize(width, height);
  frame.clipsContent = true;
  if (node.cornerRadius) frame.cornerRadius = node.cornerRadius;

  frame.fills = [
    {
      type: 'SOLID',
      color: { r: 0.94, g: 0.94, b: 0.96 },
      opacity: 1,
    },
  ];
  frame.strokes = [
    {
      type: 'SOLID',
      color: { r: 0.85, g: 0.85, b: 0.88 },
      opacity: 1,
    },
  ];
  frame.strokeWeight = 1;

  const font = await ensureFont('Inter', 'Regular');
  const fontMedium = await ensureFont('Inter', 'Medium');
  const iconSize = Math.min(width, height) * 0.12;

  const icon = figma.createText();
  icon.characters = '🖼';
  icon.fontName = font;
  icon.fontSize = iconSize;
  icon.fills = [{ type: 'SOLID', color: { r: 0.7, g: 0.7, b: 0.74 }, opacity: 1 }];

  const label = figma.createText();
  const labelText = node.alt || (node.src ? truncateUrl(node.src, 32) : 'Image');
  label.characters = labelText;
  label.fontName = fontMedium;
  label.fontSize = Math.min(14, width * 0.03);
  label.fills = [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.55 }, opacity: 1 }];

  frame.appendChild(icon);
  frame.appendChild(label);
  frame.layoutMode = 'VERTICAL';
  frame.primaryAxisAlignItems = 'CENTER';
  frame.counterAxisAlignItems = 'CENTER';
  frame.itemSpacing = 8;
  frame.paddingTop = 16;
  frame.paddingBottom = 16;
  frame.paddingLeft = 16;
  frame.paddingRight = 16;
  frame.primaryAxisSizingMode = 'FIXED';
  frame.counterAxisSizingMode = 'FIXED';

  return frame;
}
