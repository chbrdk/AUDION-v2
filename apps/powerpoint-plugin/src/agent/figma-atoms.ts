/**
 * Figma Atoms – Smallest reusable Figma operations (one node per call, no composition).
 * Used by molecules (e.g. createButton). Same null-safe rules as command-interpreter.
 */

import type { SolidFill } from './figma-command-schema';

export type NodeMap = Map<string, SceneNode>;

let idCounter = 0;
export function generateId(prefix: string): string {
  return `${prefix}_${++idCounter}`;
}

/** Minimal Figma API for atoms (DI for tests). */
export interface FigmaApiLike {
  loadFontAsync: (fontName: { family: string; style: string }) => Promise<void>;
  createFrame: () => FrameNode;
  createRectangle: () => RectangleNode;
  createEllipse: () => EllipseNode;
  createLine: () => LineNode;
  createText: () => TextNode;
  group: (nodes: ReadonlyArray<SceneNode>, parent: BaseNode & ChildrenMixin, index?: number) => GroupNode;
  /** Create a FrameNode from SVG string (plugin API: figma.createNodeFromSvg). Optional for mocks. */
  createNodeFromSvg?: (svg: string) => FrameNode;
}

function getApi(): FigmaApiLike | null {
  if (typeof figma !== 'undefined') return figma as unknown as FigmaApiLike;
  return null;
}

function applyFills(
  node: FrameNode | RectangleNode | EllipseNode | TextNode,
  fills?: SolidFill[] | null
): void {
  if (!fills || fills.length === 0) return;
  node.fills = fills.map((f) => ({
    type: 'SOLID' as const,
    color: f.color,
    opacity: f.opacity ?? 1,
  }));
}

function applyStrokes(
  node: FrameNode | RectangleNode | EllipseNode | LineNode,
  strokes?: SolidFill[] | null,
  strokeWeight?: number | null
): void {
  if (strokes && strokes.length > 0) {
    node.strokes = strokes.map((f) => ({
      type: 'SOLID' as const,
      color: f.color,
      opacity: f.opacity ?? 1,
    }));
  }
  if (strokeWeight != null && typeof strokeWeight === 'number') node.strokeWeight = strokeWeight;
}

export interface CreateFrameOpts {
  id?: string;
  name?: string;
  width?: number;
  height?: number;
  layoutMode?: 'NONE' | 'HORIZONTAL' | 'VERTICAL';
  primaryAxisSizingMode?: 'FIXED' | 'AUTO';
  counterAxisSizingMode?: 'FIXED' | 'AUTO';
  primaryAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  counterAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'BASELINE';
  itemSpacing?: number;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
  fills?: SolidFill[];
  strokes?: SolidFill[];
  strokeWeight?: number;
  cornerRadius?: number;
  opacity?: number;
  x?: number;
  y?: number;
  /** When set (in plugin), bind layout padding/spacing to these Figma Variables. */
  paddingLeftVariable?: unknown;
  paddingRightVariable?: unknown;
  paddingTopVariable?: unknown;
  paddingBottomVariable?: unknown;
  itemSpacingVariable?: unknown;
}

export function createFrame(
  nodeMap: NodeMap,
  opts: CreateFrameOpts,
  api?: FigmaApiLike | null
): string {
  const a = api ?? getApi();
  if (!a) throw new Error('No Figma API available');
  const frame = a.createFrame();
  const id = opts.id ?? generateId('frame');
  if (opts.name) frame.name = opts.name;
  frame.resize(Number(opts.width) || 100, Number(opts.height) || 100);
  if (opts.layoutMode === 'HORIZONTAL' || opts.layoutMode === 'VERTICAL' || opts.layoutMode === 'NONE') {
    frame.layoutMode = opts.layoutMode;
  }
  if (opts.primaryAxisSizingMode === 'FIXED' || opts.primaryAxisSizingMode === 'AUTO') {
    frame.primaryAxisSizingMode = opts.primaryAxisSizingMode;
  }
  if (opts.counterAxisSizingMode === 'FIXED' || opts.counterAxisSizingMode === 'AUTO') {
    frame.counterAxisSizingMode = opts.counterAxisSizingMode;
  }
  const pa = opts.primaryAxisAlignItems;
  if (pa === 'MIN' || pa === 'MAX' || pa === 'CENTER' || pa === 'SPACE_BETWEEN') {
    frame.primaryAxisAlignItems = pa;
  }
  const ca = opts.counterAxisAlignItems;
  if (ca === 'MIN' || ca === 'MAX' || ca === 'CENTER' || ca === 'BASELINE') {
    frame.counterAxisAlignItems = ca;
  }
  if (opts.itemSpacing != null && typeof opts.itemSpacing === 'number') frame.itemSpacing = opts.itemSpacing;
  // Bind layout variables first (so Figma shows tw-spacing etc.); then set numeric fallbacks only where not bound
  const setBound = (frame as any).setBoundVariable;
  if (typeof setBound === 'function') {
    if (opts.paddingLeftVariable) try { setBound.call(frame, 'paddingLeft', opts.paddingLeftVariable); } catch (_) {}
    if (opts.paddingRightVariable) try { setBound.call(frame, 'paddingRight', opts.paddingRightVariable); } catch (_) {}
    if (opts.paddingTopVariable) try { setBound.call(frame, 'paddingTop', opts.paddingTopVariable); } catch (_) {}
    if (opts.paddingBottomVariable) try { setBound.call(frame, 'paddingBottom', opts.paddingBottomVariable); } catch (_) {}
    if (opts.itemSpacingVariable) try { setBound.call(frame, 'itemSpacing', opts.itemSpacingVariable); } catch (_) {}
  }
  if (opts.paddingTop != null && typeof opts.paddingTop === 'number' && !opts.paddingTopVariable) frame.paddingTop = opts.paddingTop;
  if (opts.paddingBottom != null && typeof opts.paddingBottom === 'number' && !opts.paddingBottomVariable) frame.paddingBottom = opts.paddingBottom;
  if (opts.paddingLeft != null && typeof opts.paddingLeft === 'number' && !opts.paddingLeftVariable) frame.paddingLeft = opts.paddingLeft;
  if (opts.paddingRight != null && typeof opts.paddingRight === 'number' && !opts.paddingRightVariable) frame.paddingRight = opts.paddingRight;
  applyFills(frame, opts.fills);
  applyStrokes(frame, opts.strokes, opts.strokeWeight);
  if (opts.cornerRadius != null && typeof opts.cornerRadius === 'number') frame.cornerRadius = opts.cornerRadius;
  if (opts.opacity != null && typeof opts.opacity === 'number') frame.opacity = opts.opacity;
  if (opts.x != null && typeof opts.x === 'number') frame.x = opts.x;
  if (opts.y != null && typeof opts.y === 'number') frame.y = opts.y;
  nodeMap.set(id, frame);
  return id;
}

export interface CreateRectangleOpts {
  id?: string;
  name?: string;
  width?: number;
  height?: number;
  fills?: SolidFill[];
  strokes?: SolidFill[];
  strokeWeight?: number;
  cornerRadius?: number;
  opacity?: number;
  x?: number;
  y?: number;
  /** When set (and in plugin), bind the first fill's color to this Figma Variable. */
  fillVariable?: unknown;
  /** When set (and in plugin), bind cornerRadius to this Figma Variable. */
  cornerRadiusVariable?: unknown;
  /** When set (in plugin), bind width/height to these Figma Variables. */
  widthVariable?: unknown;
  heightVariable?: unknown;
  /** Figma variables API from plugin (set by molecules when context.variablesApi is available). */
  _variablesApi?: { setBoundVariableForPaint: (paint: unknown, field: string, variable: unknown) => unknown } | null;
}

export function createRectangle(
  nodeMap: NodeMap,
  opts: CreateRectangleOpts,
  api?: FigmaApiLike | null
): string {
  const a = api ?? getApi();
  if (!a) throw new Error('No Figma API available');
  const rect = a.createRectangle();
  const id = opts.id ?? generateId('rect');
  if (opts.name) rect.name = opts.name;
  rect.resize(Number(opts.width) || 100, Number(opts.height) || 100);
  applyFills(rect, opts.fills);
  applyStrokes(rect, opts.strokes, opts.strokeWeight);
  if (opts.cornerRadius != null && typeof opts.cornerRadius === 'number') rect.cornerRadius = opts.cornerRadius;
  if (opts.opacity != null && typeof opts.opacity === 'number') rect.opacity = opts.opacity;
  if (opts.x != null && typeof opts.x === 'number') rect.x = opts.x;
  if (opts.y != null && typeof opts.y === 'number') rect.y = opts.y;
  // Bind to Figma variables when variables API was passed from plugin
  const varsApi = opts._variablesApi;
  if (varsApi && opts.fillVariable) {
    const fills = rect.fills as readonly { type: string }[] | undefined;
    if (fills && fills.length > 0) {
      try {
        const paint = varsApi.setBoundVariableForPaint(fills[0], 'color', opts.fillVariable);
        (rect as unknown as { fills: unknown[] }).fills = [paint];
      } catch (_) {}
    }
  }
  const setBound = (rect as any).setBoundVariable;
  if (typeof setBound === 'function') {
    if (opts.cornerRadiusVariable) try { setBound.call(rect, 'cornerRadius', opts.cornerRadiusVariable); } catch (_) {}
    if (opts.widthVariable) try { setBound.call(rect, 'width', opts.widthVariable); } catch (_) {}
    if (opts.heightVariable) try { setBound.call(rect, 'height', opts.heightVariable); } catch (_) {}
  }
  nodeMap.set(id, rect);
  return id;
}

export interface CreateEllipseOpts {
  id?: string;
  name?: string;
  width?: number;
  height?: number;
  fills?: SolidFill[];
  strokes?: SolidFill[];
  strokeWeight?: number;
  opacity?: number;
  x?: number;
  y?: number;
}

export function createEllipse(
  nodeMap: NodeMap,
  opts: CreateEllipseOpts,
  api?: FigmaApiLike | null
): string {
  const a = api ?? getApi();
  if (!a) throw new Error('No Figma API available');
  const ellipse = a.createEllipse();
  const id = opts.id ?? generateId('ellipse');
  if (opts.name) ellipse.name = opts.name;
  ellipse.resize(Number(opts.width) || 100, Number(opts.height) || 100);
  applyFills(ellipse, opts.fills);
  applyStrokes(ellipse, opts.strokes, opts.strokeWeight);
  if (opts.opacity != null && typeof opts.opacity === 'number') ellipse.opacity = opts.opacity;
  if (opts.x != null && typeof opts.x === 'number') ellipse.x = opts.x;
  if (opts.y != null && typeof opts.y === 'number') ellipse.y = opts.y;
  nodeMap.set(id, ellipse);
  return id;
}

export interface CreateLineOpts {
  id?: string;
  name?: string;
  length?: number;
  x?: number;
  y?: number;
  strokes?: SolidFill[];
  strokeWeight?: number;
}

export function createLine(
  nodeMap: NodeMap,
  opts: CreateLineOpts,
  api?: FigmaApiLike | null
): string {
  const a = api ?? getApi();
  if (!a) throw new Error('No Figma API available');
  const line = a.createLine();
  const id = opts.id ?? generateId('line');
  if (opts.name) line.name = opts.name;
  const len = opts.length ?? 100;
  line.resize(len, 0);
  if (opts.x != null && typeof opts.x === 'number') line.x = opts.x;
  if (opts.y != null && typeof opts.y === 'number') line.y = opts.y;
  applyStrokes(line, opts.strokes, opts.strokeWeight);
  nodeMap.set(id, line);
  return id;
}

export interface CreateTextOpts {
  id?: string;
  name?: string;
  characters: string;
  fontSize?: number;
  fontFamily?: string;
  fontStyle?: string;
  fills?: SolidFill[];
  textAlignHorizontal?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
  textAutoResize?: 'NONE' | 'HEIGHT' | 'WIDTH_AND_HEIGHT';
  opacity?: number;
  x?: number;
  y?: number;
}

export async function loadFont(
  family: string,
  style: string,
  api?: FigmaApiLike | null
): Promise<void> {
  const a = api ?? getApi();
  if (!a) throw new Error('No Figma API available');
  await a.loadFontAsync({ family, style });
}

export async function createText(
  nodeMap: NodeMap,
  opts: CreateTextOpts,
  api?: FigmaApiLike | null
): Promise<string> {
  const a = api ?? getApi();
  if (!a) throw new Error('No Figma API available');
  const family = opts.fontFamily ?? 'Inter';
  const style = opts.fontStyle ?? 'Regular';
  await a.loadFontAsync({ family, style });
  const text = a.createText();
  const id = opts.id ?? generateId('text');
  if (opts.name) text.name = opts.name;
  text.fontName = { family, style };
  text.characters = opts.characters ?? '';
  text.fontSize = opts.fontSize != null && typeof opts.fontSize === 'number' ? opts.fontSize : 14;
  applyFills(text, opts.fills);
  const align = opts.textAlignHorizontal;
  if (align === 'LEFT' || align === 'CENTER' || align === 'RIGHT' || align === 'JUSTIFIED') {
    text.textAlignHorizontal = align;
  }
  const autoResize = opts.textAutoResize;
  if (autoResize === 'NONE' || autoResize === 'HEIGHT' || autoResize === 'WIDTH_AND_HEIGHT') {
    text.textAutoResize = autoResize;
  }
  if (opts.opacity != null && typeof opts.opacity === 'number') text.opacity = opts.opacity;
  if (opts.x != null && typeof opts.x === 'number') text.x = opts.x;
  if (opts.y != null && typeof opts.y === 'number') text.y = opts.y;
  nodeMap.set(id, text);
  return id;
}

export function appendChild(
  nodeMap: NodeMap,
  parentId: string,
  childId: string
): void {
  const parent = nodeMap.get(parentId);
  const child = nodeMap.get(childId);
  if (!parent || !('appendChild' in parent)) {
    throw new Error(`appendChild: parent "${parentId}" not found or not a container`);
  }
  if (!child) {
    throw new Error(`appendChild: child "${childId}" not found`);
  }
  (parent as BaseNode & ChildrenMixin).appendChild(child);
}

// --- createSvgNode ---

export type CreateSvgNodeResult =
  | { success: true; nodeId: string }
  | { success: false; error: string };

/**
 * Creates a FrameNode from an SVG string via figma.createNodeFromSvg(svg).
 * The node is stored in nodeMap under nodeId. Call appendChild(parentId, nodeId) to place it.
 */
export function createSvgNode(
  nodeMap: NodeMap,
  svgCode: string,
  id?: string,
  api?: FigmaApiLike | null
): CreateSvgNodeResult {
  const a = api ?? getApi();
  if (!a) {
    return { success: false, error: 'No Figma API available' };
  }
  const createFromSvg = a.createNodeFromSvg ?? (typeof figma !== 'undefined' && (figma as any).createNodeFromSvg);
  if (!createFromSvg || typeof createFromSvg !== 'function') {
    return { success: false, error: 'createNodeFromSvg not available (plugin context required)' };
  }
  if (!svgCode || typeof svgCode !== 'string' || svgCode.trim().length === 0) {
    return { success: false, error: 'createSvgNode: svgCode must be a non-empty string' };
  }
  try {
    const frame = createFromSvg(svgCode.trim());
    const nodeId = id ?? generateId('svg');
    if (frame.name == null || frame.name === '') frame.name = 'SVG';
    nodeMap.set(nodeId, frame);
    return { success: true, nodeId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `createSvgNode: ${message}` };
  }
}

// --- groupNodes ---

export interface GroupNodesArgs {
  parentId: string;
  childIds: string[];
  id?: string;
}

export type GroupNodesResult =
  | { success: true; groupId: string }
  | { success: false; error: string };

/**
 * Groups existing nodes under a parent. Uses figma.group(nodes, parent); the new group is stored in nodeMap.
 * Child nodes remain in nodeMap (they are now inside the group).
 */
export function groupNodes(
  nodeMap: NodeMap,
  parentId: string,
  childIds: string[],
  id?: string,
  api?: FigmaApiLike | null
): GroupNodesResult {
  const a = api ?? getApi();
  if (!a || !a.group) {
    return { success: false, error: 'No Figma API or group not available' };
  }
  const parent = nodeMap.get(parentId);
  if (!parent || !('appendChild' in parent)) {
    return { success: false, error: `groupNodes: parent "${parentId}" not found or not a container` };
  }
  if (!childIds || childIds.length === 0) {
    return { success: false, error: 'groupNodes: childIds array is required and must not be empty' };
  }
  const children = childIds
    .map((cid) => nodeMap.get(cid))
    .filter((n): n is SceneNode => n != null);
  if (children.length !== childIds.length) {
    return { success: false, error: 'groupNodes: some childIds not found in nodeMap' };
  }
  try {
    const groupNode = a.group(children, parent as BaseNode & ChildrenMixin);
    const groupId = id ?? generateId('group');
    nodeMap.set(groupId, groupNode);
    return { success: true, groupId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
