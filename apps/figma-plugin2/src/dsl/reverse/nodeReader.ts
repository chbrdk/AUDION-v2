import type { DSLNode, DSLFrame, DSLText } from '../types';
import type { ResolvedTokens } from '../tokens';
import { inferTextStyle } from './inferStyles';

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.round(Math.max(0, Math.min(1, n)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function extractFillColor(node: SceneNode): string | undefined {
  if (!('fills' in node) || !node.fills || node.fills === figma.mixed) return undefined;
  const fills = node.fills as Paint[];
  const solid = fills.find((f) => f.type === 'SOLID') as SolidPaint | undefined;
  if (!solid?.color) return undefined;
  const { r, g, b } = solid.color;
  const a = solid.opacity ?? 1;
  const hex = rgbToHex(r, g, b);
  return a < 1 ? hex + Math.round(a * 255).toString(16).padStart(2, '0') : hex;
}

function extractCornerRadius(node: SceneNode): number | undefined {
  if (!('cornerRadius' in node) || typeof node.cornerRadius !== 'number') return undefined;
  return node.cornerRadius;
}

function mapTextAlign(
  align: string
): 'left' | 'center' | 'right' {
  if (align === 'CENTER') return 'center';
  if (align === 'RIGHT') return 'right';
  return 'left';
}

export function figmaNodeToDSL(
  node: SceneNode,
  tokens: ResolvedTokens
): DSLNode | null {
  if (node.type === 'TEXT') {
    const textNode = node as TextNode;
    return {
      type: 'text',
      content: textNode.characters,
      fill: extractFillColor(textNode),
      align: mapTextAlign(textNode.textAlignHorizontal),
      style: inferTextStyle(textNode, tokens),
    } as DSLText;
  }

  if (
    node.type === 'FRAME' ||
    node.type === 'COMPONENT' ||
    node.type === 'INSTANCE'
  ) {
    const frameNode = node as FrameNode;
    const children: DSLNode[] = [];
    for (const child of frameNode.children) {
      const dsl = figmaNodeToDSL(child, tokens);
      if (dsl) children.push(dsl);
    }
    const layout =
      frameNode.layoutMode === 'HORIZONTAL'
        ? 'horizontal'
        : frameNode.layoutMode === 'VERTICAL'
          ? 'vertical'
          : 'none';
    return {
      type: 'frame',
      name: frameNode.name,
      layout,
      width: frameNode.width,
      height: frameNode.height,
      padding: [
        frameNode.paddingTop,
        frameNode.paddingRight,
        frameNode.paddingBottom,
        frameNode.paddingLeft,
      ],
      gap: frameNode.itemSpacing,
      fill: extractFillColor(frameNode),
      cornerRadius: extractCornerRadius(frameNode),
      children,
    } as DSLFrame;
  }

  if (node.type === 'GROUP') {
    const groupNode = node as GroupNode;
    const children: DSLNode[] = [];
    for (const child of groupNode.children) {
      const dsl = figmaNodeToDSL(child, tokens);
      if (dsl) children.push(dsl);
    }
    const b = groupNode.absoluteBoundingBox;
    return {
      type: 'frame',
      name: groupNode.name,
      layout: 'vertical',
      width: b ? b.width : 100,
      height: b ? b.height : 100,
      children,
    } as DSLFrame;
  }

  if (node.type === 'RECTANGLE') {
    const rect = node as RectangleNode;
    return {
      type: 'frame',
      name: rect.name,
      width: rect.width,
      height: rect.height,
      fill: extractFillColor(rect),
      cornerRadius: extractCornerRadius(rect),
    } as DSLFrame;
  }

  if (node.type === 'ELLIPSE') {
    const ellipse = node as EllipseNode;
    const w = ellipse.width;
    const h = ellipse.height;
    return {
      type: 'frame',
      name: ellipse.name,
      width: w,
      height: h,
      fill: extractFillColor(ellipse),
      cornerRadius: Math.min(w, h) / 2,
    } as DSLFrame;
  }

  return null;
}
