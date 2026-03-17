/**
 * Figma Molecules – Composed from atoms only (e.g. createButton = Frame + Rectangle + Text).
 * Used by tool executor / agent. No dependency on command-interpreter.
 */

import type { SolidFill } from './figma-command-schema';
import type { NodeMap, FigmaApiLike } from './figma-atoms';
import {
  createFrame,
  createRectangle,
  createEllipse,
  createLine,
  createText,
  loadFont,
  appendChild,
  generateId,
  createSvgNode,
} from './figma-atoms';

export interface ToolContext {
  nodeMap: NodeMap;
  api?: FigmaApiLike | null;
}

export interface CreateButtonArgs {
  parentId: string;
  label: string;
  variant?: 'primary' | 'secondary' | 'outline';
  width?: number;
  id?: string;
}

export type CreateButtonResult =
  | { success: true; buttonId: string }
  | { success: false; error: string };

const DEFAULT_BUTTON_HEIGHT = 44;
const BUTTON_PADDING = 12;

function buttonFillsForVariant(variant: 'primary' | 'secondary' | 'outline'): SolidFill[] | undefined {
  switch (variant) {
    case 'primary':
      return [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2 }, opacity: 1 }];
    case 'secondary':
      return [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 }, opacity: 1 }];
    case 'outline':
      return undefined;
    default:
      return [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2 }, opacity: 1 }];
  }
}

function buttonStrokesForVariant(variant: 'primary' | 'secondary' | 'outline'): SolidFill[] | undefined {
  if (variant === 'outline') {
    return [{ type: 'SOLID', color: { r: 0.3, g: 0.3, b: 0.3 }, opacity: 1 }];
  }
  return undefined;
}

/**
 * Creates a button (Frame container + Rectangle background + Text label).
 * Uses only atoms. parentId must exist in nodeMap and be a container (Frame/Page).
 */
export async function createButton(
  context: ToolContext,
  args: CreateButtonArgs
): Promise<CreateButtonResult> {
  const { nodeMap, api } = context;
  const parent = nodeMap.get(args.parentId);
  if (!parent || !('appendChild' in parent)) {
    return { success: false, error: `createButton: parent "${args.parentId}" not found or not a container` };
  }

  const variant = args.variant ?? 'primary';
  const width = args.width ?? 140;
  const height = DEFAULT_BUTTON_HEIGHT;
  const buttonId = args.id ?? generateId('btn');

  try {
    // 1. Frame for button container (no layout so rect and text can overlap)
    createFrame(nodeMap, {
      id: buttonId,
      name: `Button: ${args.label}`,
      width,
      height,
      layoutMode: 'NONE',
      fills: undefined,
    }, api);

    // 2. Rectangle for background
    const rectId = generateId('btn_rect');
    createRectangle(nodeMap, {
      id: rectId,
      name: 'Button background',
      width,
      height,
      fills: buttonFillsForVariant(variant),
      strokes: buttonStrokesForVariant(variant),
      strokeWeight: variant === 'outline' ? 1 : undefined,
      cornerRadius: 8,
    }, api);

    // 3. Load font and create text label
    await loadFont('Inter', 'Regular', api);
    const textId = generateId('btn_text');
    const textFill: SolidFill = variant === 'primary'
      ? { type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 1 }
      : { type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2 }, opacity: 1 };
    await createText(nodeMap, {
      id: textId,
      name: 'Button label',
      characters: args.label,
      fontSize: 14,
      fontFamily: 'Inter',
      fontStyle: 'Regular',
      fills: [textFill],
      textAutoResize: 'HEIGHT',
      x: BUTTON_PADDING,
      y: (height - 14) / 2,
    }, api);

    // 4. Build hierarchy: rect and text into button frame, then button frame into parent
    appendChild(nodeMap, buttonId, rectId);
    appendChild(nodeMap, buttonId, textId);
    appendChild(nodeMap, args.parentId, buttonId);

    return { success: true, buttonId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// --- createButtonRow ---

export interface CreateButtonRowButton {
  label: string;
  variant?: 'primary' | 'secondary' | 'outline';
}

export interface CreateButtonRowArgs {
  parentId: string;
  buttons: CreateButtonRowButton[];
  direction?: 'horizontal' | 'vertical';
  gap?: number;
  id?: string;
}

export type CreateButtonRowResult =
  | { success: true; buttonRowId: string; buttonIds: string[] }
  | { success: false; error: string };

/**
 * Creates a row or column of buttons. Use for CTAs like "Abbrechen" + "Weiter" side by side,
 * or stacked. Layout is horizontal (default) or vertical via direction.
 */
export async function createButtonRow(
  context: ToolContext,
  args: CreateButtonRowArgs
): Promise<CreateButtonRowResult> {
  const { nodeMap, api } = context;
  const parent = nodeMap.get(args.parentId);
  if (!parent || !('appendChild' in parent)) {
    return { success: false, error: `createButtonRow: parent "${args.parentId}" not found or not a container` };
  }

  if (!args.buttons || args.buttons.length === 0) {
    return { success: false, error: 'createButtonRow: buttons array is required and must not be empty' };
  }

  const direction = args.direction ?? 'horizontal';
  const gap = args.gap ?? 12;
  const buttonRowId = args.id ?? generateId('button_row');
  const defaultBtnWidth = 140;
  const n = args.buttons.length;
  const rowWidth = direction === 'horizontal'
    ? n * defaultBtnWidth + (n - 1) * gap
    : defaultBtnWidth;
  const rowHeight = direction === 'horizontal'
    ? DEFAULT_BUTTON_HEIGHT
    : n * DEFAULT_BUTTON_HEIGHT + (n - 1) * gap;

  try {
    createFrame(nodeMap, {
      id: buttonRowId,
      name: 'Button row',
      width: rowWidth,
      height: rowHeight,
      layoutMode: direction === 'horizontal' ? 'HORIZONTAL' : 'VERTICAL',
      primaryAxisSizingMode: 'FIXED',
      counterAxisSizingMode: 'FIXED',
      itemSpacing: gap,
      paddingTop: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      paddingRight: 0,
    }, api);

    appendChild(nodeMap, args.parentId, buttonRowId);

    const buttonIds: string[] = [];
    for (let i = 0; i < args.buttons.length; i++) {
      const btn = args.buttons[i];
      const result = await createButton(context, {
        parentId: buttonRowId,
        label: btn.label,
        variant: btn.variant,
        id: `${buttonRowId}_btn_${i}`,
      });
      if (!result.success) return result;
      buttonIds.push(result.buttonId);
    }

    return { success: true, buttonRowId, buttonIds };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// --- createIconButton ---

export interface CreateIconButtonArgs {
  parentId: string;
  /** SVG markup for the icon (e.g. a simple path or full <svg>...</svg>). */
  iconSvg?: string;
  /** Button label. If only label (no iconSvg), behaves like createButton. */
  label?: string;
  variant?: 'primary' | 'secondary' | 'outline';
  /** Icon size in px (default 24). Button height default 44. */
  iconSize?: number;
  id?: string;
}

export type CreateIconButtonResult =
  | { success: true; buttonId: string }
  | { success: false; error: string };

const ICON_BUTTON_HEIGHT = 44;
const ICON_BUTTON_PADDING = 12;
const DEFAULT_ICON_SIZE = 24;

/**
 * Creates a button with optional icon (from SVG code) and/or label.
 * Icon-only: square button with centered icon. Icon+label: horizontal layout with icon left, label right.
 * Label-only: delegates to createButton.
 */
export async function createIconButton(
  context: ToolContext,
  args: CreateIconButtonArgs
): Promise<CreateIconButtonResult> {
  const { nodeMap, api } = context;
  const parent = nodeMap.get(args.parentId);
  if (!parent || !('appendChild' in parent)) {
    return { success: false, error: `createIconButton: parent "${args.parentId}" not found or not a container` };
  }

  const hasIcon = args.iconSvg != null && args.iconSvg.trim().length > 0;
  const hasLabel = args.label != null && args.label.trim().length > 0;
  if (!hasIcon && !hasLabel) {
    return { success: false, error: 'createIconButton: provide iconSvg and/or label' };
  }

  if (!hasIcon) {
    return createButton(context, {
      parentId: args.parentId,
      label: args.label!,
      variant: args.variant,
      id: args.id,
    });
  }

  const iconSize = args.iconSize ?? DEFAULT_ICON_SIZE;
  const height = ICON_BUTTON_HEIGHT;
  const buttonId = args.id ?? generateId('icon_btn');

  try {
    if (!hasLabel) {
      const width = height;
      const rectId = generateId('icon_btn_rect');
      createFrame(nodeMap, {
        id: buttonId,
        name: 'Icon button',
        width,
        height,
        layoutMode: 'NONE',
      }, api);
      createRectangle(nodeMap, {
        id: rectId,
        name: 'Background',
        width,
        height,
        fills: buttonFillsForVariant(args.variant ?? 'primary'),
        strokes: buttonStrokesForVariant(args.variant ?? 'primary'),
        strokeWeight: args.variant === 'outline' ? 1 : undefined,
        cornerRadius: 8,
      }, api);
      const svgResult = createSvgNode(nodeMap, args.iconSvg!.trim(), generateId('icon_btn_svg'), api);
      if (!svgResult.success) return svgResult;
      const svgNode = nodeMap.get(svgResult.nodeId);
      if (svgNode && 'resize' in svgNode) {
        (svgNode as { resize: (w: number, h: number) => void }).resize(iconSize, iconSize);
      }
      if (svgNode && 'x' in svgNode && 'y' in svgNode) {
        (svgNode as { x: number; y: number }).x = (width - iconSize) / 2;
        (svgNode as { x: number; y: number }).y = (height - iconSize) / 2;
      }
      appendChild(nodeMap, buttonId, rectId);
      appendChild(nodeMap, buttonId, svgResult.nodeId);
      appendChild(nodeMap, args.parentId, buttonId);
      return { success: true, buttonId };
    }

    const gap = 8;
    await loadFont('Inter', 'Regular', api);
    const textId = generateId('icon_btn_text');
    const textFill: SolidFill = args.variant === 'primary'
      ? { type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 1 }
      : { type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2 }, opacity: 1 };
    await createText(nodeMap, {
      id: textId,
      name: 'Label',
      characters: args.label!,
      fontSize: 14,
      fontFamily: 'Inter',
      fontStyle: 'Regular',
      fills: [textFill],
      textAutoResize: 'HEIGHT',
    }, api);
    const textNode = nodeMap.get(textId);
    const textW = textNode && 'width' in textNode ? (textNode as { width: number }).width : 60;
    const width = ICON_BUTTON_PADDING + iconSize + gap + textW + ICON_BUTTON_PADDING;
    const rectId = generateId('icon_btn_rect');

    createFrame(nodeMap, {
      id: buttonId,
      name: `Icon button: ${args.label}`,
      width,
      height,
      layoutMode: 'NONE',
    }, api);
    createRectangle(nodeMap, {
      id: rectId,
      name: 'Background',
      width,
      height,
      fills: buttonFillsForVariant(args.variant ?? 'primary'),
      strokes: buttonStrokesForVariant(args.variant ?? 'primary'),
      strokeWeight: args.variant === 'outline' ? 1 : undefined,
      cornerRadius: 8,
    }, api);
    const svgResult = createSvgNode(nodeMap, args.iconSvg!.trim(), generateId('icon_btn_svg'), api);
    if (!svgResult.success) return svgResult;
    const svgNode = nodeMap.get(svgResult.nodeId);
    if (svgNode && 'resize' in svgNode) {
      (svgNode as { resize: (w: number, h: number) => void }).resize(iconSize, iconSize);
    }
    if (svgNode && 'x' in svgNode && 'y' in svgNode) {
      (svgNode as { x: number; y: number }).x = ICON_BUTTON_PADDING;
      (svgNode as { x: number; y: number }).y = (height - iconSize) / 2;
    }
    if (textNode && 'x' in textNode && 'y' in textNode) {
      (textNode as { x: number; y: number }).x = ICON_BUTTON_PADDING + iconSize + gap;
      (textNode as { y: number }).y = (height - 14) / 2;
    }
    appendChild(nodeMap, buttonId, rectId);
    appendChild(nodeMap, buttonId, svgResult.nodeId);
    appendChild(nodeMap, buttonId, textId);
    appendChild(nodeMap, args.parentId, buttonId);
    return { success: true, buttonId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// --- createStage ---

export interface CreateStageArgs {
  width?: number;
  height?: number;
  name?: string;
  id?: string;
}

export type CreateStageResult =
  | { success: true; stageId: string }
  | { success: false; error: string };

/**
 * Creates the main container frame (Bühne) and appends it to the current page.
 * All sections should be created inside this stage via createSection(parentId: stageId).
 */
export function createStage(
  context: ToolContext,
  args: CreateStageArgs
): CreateStageResult {
  const { nodeMap, api } = context;
  const stageId = args.id ?? 'stage';

  try {
    createFrame(nodeMap, {
      id: stageId,
      name: args.name ?? 'Wireframe',
      width: args.width ?? 1440,
      height: args.height ?? 1024,
      layoutMode: 'VERTICAL',
      primaryAxisSizingMode: 'AUTO',
      counterAxisSizingMode: 'FIXED',
      itemSpacing: 0,
      paddingTop: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      paddingRight: 0,
    }, api);

    const stageNode = nodeMap.get(stageId);
    if (stageNode && typeof figma !== 'undefined') {
      figma.currentPage.appendChild(stageNode);
    }

    return { success: true, stageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// --- createSection ---

export type SpacingPreset = 'compact' | 'normal' | 'spacious';

const SPACING_VALUES: Record<SpacingPreset, { gap: number; padding: number }> = {
  compact: { gap: 8, padding: 12 },
  normal: { gap: 16, padding: 20 },
  spacious: { gap: 24, padding: 32 },
};

export interface CreateSectionArgs {
  parentId: string;
  name?: string;
  direction?: 'vertical' | 'horizontal';
  spacing?: SpacingPreset;
  gap?: number;
  padding?: number;
  width?: number;
  height?: number;
  align?: 'min' | 'center' | 'max';
  id?: string;
}

export type CreateSectionResult =
  | { success: true; sectionId: string }
  | { success: false; error: string };

/**
 * Creates a section container (Frame) and appends it to the given parent (e.g. stage).
 * parentId must exist in nodeMap and be a container (Frame/Page).
 * Use spacing preset for consistent gap/padding, or set gap/padding explicitly.
 */
export function createSection(
  context: ToolContext,
  args: CreateSectionArgs
): CreateSectionResult {
  const { nodeMap, api } = context;
  const parent = nodeMap.get(args.parentId);
  if (!parent || !('appendChild' in parent)) {
    return { success: false, error: `createSection: parent "${args.parentId}" not found or not a container` };
  }

  const direction = args.direction ?? 'vertical';
  const preset = args.spacing ? SPACING_VALUES[args.spacing] : null;
  const gap = args.gap ?? preset?.gap ?? 16;
  const padding = args.padding ?? preset?.padding ?? 20;
  const sectionId = args.id ?? generateId('section');

  const counterAxisAlign = args.align === 'center' ? 'CENTER' as const : args.align === 'max' ? 'MAX' as const : args.align === 'min' ? 'MIN' as const : undefined;

  try {
    createFrame(nodeMap, {
      id: sectionId,
      name: args.name ?? `Section ${sectionId}`,
      width: args.width ?? 400,
      height: args.height ?? 300,
      layoutMode: direction === 'horizontal' ? 'HORIZONTAL' : 'VERTICAL',
      itemSpacing: gap,
      paddingTop: padding,
      paddingBottom: padding,
      paddingLeft: padding,
      paddingRight: padding,
      counterAxisAlignItems: counterAxisAlign,
    }, api);

    appendChild(nodeMap, args.parentId, sectionId);
    return { success: true, sectionId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// --- createRow ---

export interface CreateRowArgs {
  parentId: string;
  name?: string;
  gap?: number;
  padding?: number;
  align?: 'min' | 'center' | 'max';
  id?: string;
}

export type CreateRowResult =
  | { success: true; rowId: string }
  | { success: false; error: string };

/**
 * Creates a horizontal row container (for multi-column layouts). Add sections with createSection(parentId: rowId) to get columns side by side.
 */
export function createRow(
  context: ToolContext,
  args: CreateRowArgs
): CreateRowResult {
  const { nodeMap, api } = context;
  const parent = nodeMap.get(args.parentId);
  if (!parent || !('appendChild' in parent)) {
    return { success: false, error: `createRow: parent "${args.parentId}" not found or not a container` };
  }

  const rowId = args.id ?? generateId('row');
  const gap = args.gap ?? 24;
  const padding = args.padding ?? 20;
  const rowCounterAlign = args.align === 'center' ? 'CENTER' as const : args.align === 'max' ? 'MAX' as const : args.align === 'min' ? 'MIN' as const : undefined;

  try {
    createFrame(nodeMap, {
      id: rowId,
      name: args.name ?? `Row ${rowId}`,
      width: 800,
      height: 200,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizingMode: 'AUTO',
      counterAxisSizingMode: 'FIXED',
      itemSpacing: gap,
      paddingTop: padding,
      paddingBottom: padding,
      paddingLeft: padding,
      paddingRight: padding,
      counterAxisAlignItems: rowCounterAlign,
    }, api);

    appendChild(nodeMap, args.parentId, rowId);
    return { success: true, rowId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// --- setLayout ---

export interface SetLayoutArgs {
  nodeId: string;
  layoutMode?: 'NONE' | 'HORIZONTAL' | 'VERTICAL';
  itemSpacing?: number;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
  primaryAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  counterAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX';
}

export type SetLayoutResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Updates layout properties of an existing Frame. nodeId must reference a FrameNode in nodeMap.
 */
export function setLayout(
  context: ToolContext,
  args: SetLayoutArgs
): SetLayoutResult {
  const { nodeMap } = context;
  const node = nodeMap.get(args.nodeId);
  if (!node) {
    return { success: false, error: `setLayout: node "${args.nodeId}" not found` };
  }
  if (!('layoutMode' in node)) {
    return { success: false, error: `setLayout: node "${args.nodeId}" is not a Frame (no layoutMode)` };
  }

  const frame = node as FrameNode;
  try {
    if (args.layoutMode === 'NONE' || args.layoutMode === 'HORIZONTAL' || args.layoutMode === 'VERTICAL') {
      frame.layoutMode = args.layoutMode;
    }
    if (args.itemSpacing != null && typeof args.itemSpacing === 'number') frame.itemSpacing = args.itemSpacing;
    if (args.paddingTop != null && typeof args.paddingTop === 'number') frame.paddingTop = args.paddingTop;
    if (args.paddingBottom != null && typeof args.paddingBottom === 'number') frame.paddingBottom = args.paddingBottom;
    if (args.paddingLeft != null && typeof args.paddingLeft === 'number') frame.paddingLeft = args.paddingLeft;
    if (args.paddingRight != null && typeof args.paddingRight === 'number') frame.paddingRight = args.paddingRight;
    const pa = args.primaryAxisAlignItems;
    if (pa === 'MIN' || pa === 'CENTER' || pa === 'MAX' || pa === 'SPACE_BETWEEN') frame.primaryAxisAlignItems = pa;
    const ca = args.counterAxisAlignItems;
    if (ca === 'MIN' || ca === 'CENTER' || ca === 'MAX') frame.counterAxisAlignItems = ca;
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// --- createDivider ---

export interface CreateDividerArgs {
  parentId: string;
  orientation?: 'horizontal' | 'vertical';
  length?: number;
  strokeWeight?: number;
  id?: string;
}

export type CreateDividerResult =
  | { success: true; dividerId: string }
  | { success: false; error: string };

const DIVIDER_STROKE: SolidFill = { type: 'SOLID', color: { r: 0.85, g: 0.85, b: 0.85 }, opacity: 1 };

/**
 * Creates a divider line (horizontal or vertical) in a wrapper frame and appends to parent.
 */
export function createDivider(
  context: ToolContext,
  args: CreateDividerArgs
): CreateDividerResult {
  const { nodeMap, api } = context;
  const parent = nodeMap.get(args.parentId);
  if (!parent || !('appendChild' in parent)) {
    return { success: false, error: `createDivider: parent "${args.parentId}" not found or not a container` };
  }

  const orientation = args.orientation ?? 'horizontal';
  const length = args.length ?? 200;
  const strokeWeight = args.strokeWeight ?? 1;
  const dividerId = args.id ?? generateId('divider');

  try {
    const isVertical = orientation === 'vertical';
    const frameW = isVertical ? strokeWeight : length;
    const frameH = isVertical ? length : strokeWeight;

    createFrame(nodeMap, {
      id: dividerId,
      name: `Divider: ${orientation}`,
      width: frameW,
      height: frameH,
      layoutMode: 'NONE',
    }, api);

    const lineId = generateId('divider_line');
    createLine(nodeMap, {
      id: lineId,
      name: 'Line',
      length,
      x: 0,
      y: 0,
      strokes: [DIVIDER_STROKE],
      strokeWeight,
    }, api);

    const lineNode = nodeMap.get(lineId);
    if (isVertical && lineNode && 'rotation' in lineNode) {
      (lineNode as { rotation: number }).rotation = Math.PI / 2;
      (lineNode as { x: number }).x = 0;
      (lineNode as { y: number }).y = length;
    }

    appendChild(nodeMap, dividerId, lineId);
    appendChild(nodeMap, args.parentId, dividerId);
    return { success: true, dividerId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// --- createAvatar ---

export interface CreateAvatarArgs {
  parentId: string;
  initials: string;
  size?: number;
  id?: string;
}

export type CreateAvatarResult =
  | { success: true; avatarId: string }
  | { success: false; error: string };

const AVATAR_FILL: SolidFill = { type: 'SOLID', color: { r: 0.75, g: 0.75, b: 0.78 }, opacity: 1 };
const AVATAR_TEXT_FILL: SolidFill = { type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 1 };

/**
 * Creates an avatar: circle (ellipse) with centered initials text.
 */
export async function createAvatar(
  context: ToolContext,
  args: CreateAvatarArgs
): Promise<CreateAvatarResult> {
  const { nodeMap, api } = context;
  const parent = nodeMap.get(args.parentId);
  if (!parent || !('appendChild' in parent)) {
    return { success: false, error: `createAvatar: parent "${args.parentId}" not found or not a container` };
  }

  const size = args.size ?? 40;
  const avatarId = args.id ?? generateId('avatar');
  const initials = (args.initials || '?').slice(0, 2).toUpperCase();

  try {
    createFrame(nodeMap, {
      id: avatarId,
      name: `Avatar: ${initials}`,
      width: size,
      height: size,
      layoutMode: 'NONE',
    }, api);

    const ellipseId = generateId('avatar_ellipse');
    createEllipse(nodeMap, {
      id: ellipseId,
      name: 'Circle',
      width: size,
      height: size,
      fills: [AVATAR_FILL],
    }, api);
    appendChild(nodeMap, avatarId, ellipseId);

    await loadFont('Inter', 'Semi Bold', api);
    const textId = generateId('avatar_text');
    const fontSize = Math.max(10, Math.round(size * 0.4));
    await createText(nodeMap, {
      id: textId,
      name: 'Initials',
      characters: initials,
      fontSize,
      fontFamily: 'Inter',
      fontStyle: 'Semi Bold',
      fills: [AVATAR_TEXT_FILL],
      textAlignHorizontal: 'CENTER',
      textAutoResize: 'HEIGHT',
      x: Math.round((size - fontSize) / 2),
      y: Math.round((size - fontSize) / 2),
    }, api);
    appendChild(nodeMap, avatarId, textId);
    appendChild(nodeMap, args.parentId, avatarId);

    return { success: true, avatarId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// --- createBadge ---

export interface CreateBadgeArgs {
  parentId: string;
  label: string;
  variant?: 'default' | 'primary' | 'success';
  id?: string;
}

export type CreateBadgeResult =
  | { success: true; badgeId: string }
  | { success: false; error: string };

function badgeStyle(variant: 'default' | 'primary' | 'success'): { fill: SolidFill; textFill: SolidFill } {
  switch (variant) {
    case 'primary':
      return {
        fill: { type: 'SOLID', color: { r: 0.2, g: 0.4, b: 0.9 }, opacity: 1 },
        textFill: { type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 1 },
      };
    case 'success':
      return {
        fill: { type: 'SOLID', color: { r: 0.2, g: 0.7, b: 0.4 }, opacity: 1 },
        textFill: { type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 1 },
      };
    default:
      return {
        fill: { type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.92 }, opacity: 1 },
        textFill: { type: 'SOLID', color: { r: 0.3, g: 0.3, b: 0.3 }, opacity: 1 },
      };
  }
}

/**
 * Creates a pill-style badge with label text.
 */
export async function createBadge(
  context: ToolContext,
  args: CreateBadgeArgs
): Promise<CreateBadgeResult> {
  const { nodeMap, api } = context;
  const parent = nodeMap.get(args.parentId);
  if (!parent || !('appendChild' in parent)) {
    return { success: false, error: `createBadge: parent "${args.parentId}" not found or not a container` };
  }

  const variant = args.variant ?? 'default';
  const label = args.label || 'Badge';
  const badgeId = args.id ?? generateId('badge');
  const paddingH = 10;
  const paddingV = 4;
  const fontSize = 12;
  const height = paddingV * 2 + fontSize;

  try {
    await loadFont('Inter', 'Medium', api);
    const textId = generateId('badge_text');
    await createText(nodeMap, {
      id: textId,
      name: 'Badge label',
      characters: label,
      fontSize,
      fontFamily: 'Inter',
      fontStyle: 'Medium',
      fills: [badgeStyle(variant).textFill],
      textAutoResize: 'HEIGHT',
    }, api);
    const textNode = nodeMap.get(textId);
    const textWidth = (textNode && 'width' in textNode ? (textNode as { width: number }).width : 0) || label.length * 8;
    const width = Math.round(textWidth) + paddingH * 2;

    createFrame(nodeMap, {
      id: badgeId,
      name: `Badge: ${label.slice(0, 20)}`,
      width,
      height,
      layoutMode: 'NONE',
    }, api);

    const rectId = generateId('badge_rect');
    createRectangle(nodeMap, {
      id: rectId,
      name: 'Pill',
      width,
      height,
      fills: [badgeStyle(variant).fill],
      cornerRadius: height / 2,
      x: 0,
      y: 0,
    }, api);
    appendChild(nodeMap, badgeId, rectId);
    appendChild(nodeMap, badgeId, textId);

    const textNodeAgain = nodeMap.get(textId);
    if (textNodeAgain && 'x' in textNodeAgain) {
      (textNodeAgain as { x: number }).x = paddingH;
      (textNodeAgain as { y: number }).y = paddingV;
    }
    appendChild(nodeMap, args.parentId, badgeId);

    return { success: true, badgeId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// --- createSpacer ---

export interface CreateSpacerArgs {
  parentId: string;
  width?: number;
  height?: number;
  id?: string;
}

export type CreateSpacerResult =
  | { success: true; spacerId: string }
  | { success: false; error: string };

/**
 * Creates an empty spacer frame (invisible gap) and appends to parent.
 */
export function createSpacer(
  context: ToolContext,
  args: CreateSpacerArgs
): CreateSpacerResult {
  const { nodeMap, api } = context;
  const parent = nodeMap.get(args.parentId);
  if (!parent || !('appendChild' in parent)) {
    return { success: false, error: `createSpacer: parent "${args.parentId}" not found or not a container` };
  }

  const width = args.width ?? 16;
  const height = args.height ?? 16;
  const spacerId = args.id ?? generateId('spacer');

  try {
    createFrame(nodeMap, {
      id: spacerId,
      name: 'Spacer',
      width,
      height,
      layoutMode: 'NONE',
    }, api);
    appendChild(nodeMap, args.parentId, spacerId);
    return { success: true, spacerId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// --- createInput ---

export interface CreateInputArgs {
  parentId: string;
  label?: string;
  placeholder?: string;
  id?: string;
}

export type CreateInputResult =
  | { success: true; inputId: string }
  | { success: false; error: string };

const INPUT_FIELD_HEIGHT = 36;
const INPUT_WIDTH = 280;
const INPUT_STROKE: SolidFill = { type: 'SOLID', color: { r: 0.75, g: 0.75, b: 0.78 }, opacity: 1 };
const INPUT_PLACEHOLDER_FILL: SolidFill = { type: 'SOLID', color: { r: 0.55, g: 0.55, b: 0.55 }, opacity: 1 };

/**
 * Creates a single input field: optional label, stroke rectangle as field, optional placeholder text.
 */
export async function createInput(
  context: ToolContext,
  args: CreateInputArgs
): Promise<CreateInputResult> {
  const { nodeMap, api } = context;
  const parent = nodeMap.get(args.parentId);
  if (!parent || !('appendChild' in parent)) {
    return { success: false, error: `createInput: parent "${args.parentId}" not found or not a container` };
  }

  const inputId = args.id ?? generateId('input');
  const labelGap = 4;
  const totalHeight = (args.label ? 12 + labelGap : 0) + INPUT_FIELD_HEIGHT;

  try {
    createFrame(nodeMap, {
      id: inputId,
      name: `Input: ${(args.label || args.placeholder || 'Field').slice(0, 30)}`,
      width: INPUT_WIDTH,
      height: totalHeight,
      layoutMode: 'VERTICAL',
      itemSpacing: labelGap,
      paddingTop: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      paddingRight: 0,
    }, api);

    if (args.label) {
      const labelResult = await addText(context, {
        parentId: inputId,
        content: args.label,
        variant: 'small',
        id: `${inputId}_label`,
      });
      if (!labelResult.success) return labelResult;
    }

    const fieldFrameId = generateId('input_field');
    createFrame(nodeMap, {
      id: fieldFrameId,
      name: 'Field',
      width: INPUT_WIDTH,
      height: INPUT_FIELD_HEIGHT,
      layoutMode: 'NONE',
    }, api);

    const rectId = generateId('input_rect');
    createRectangle(nodeMap, {
      id: rectId,
      name: 'Border',
      width: INPUT_WIDTH,
      height: INPUT_FIELD_HEIGHT,
      cornerRadius: 4,
      strokes: [INPUT_STROKE],
      strokeWeight: 1,
      x: 0,
      y: 0,
    }, api);
    appendChild(nodeMap, fieldFrameId, rectId);

    if (args.placeholder) {
      await loadFont('Inter', 'Regular', api);
      const phTextId = generateId('input_ph');
      await createText(nodeMap, {
        id: phTextId,
        name: 'Placeholder',
        characters: args.placeholder,
        fontSize: 12,
        fontFamily: 'Inter',
        fontStyle: 'Regular',
        fills: [INPUT_PLACEHOLDER_FILL],
        x: 8,
        y: Math.round((INPUT_FIELD_HEIGHT - 12) / 2),
      }, api);
      appendChild(nodeMap, fieldFrameId, phTextId);
    }

    appendChild(nodeMap, inputId, fieldFrameId);
    appendChild(nodeMap, args.parentId, inputId);
    return { success: true, inputId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// --- createForm ---

export interface CreateFormField {
  label: string;
  placeholder?: string;
}

export interface CreateFormArgs {
  parentId: string;
  fields: CreateFormField[];
  title?: string;
  id?: string;
}

export type CreateFormResult =
  | { success: true; formId: string }
  | { success: false; error: string };

/**
 * Creates a form container (section) with optional title and one createInput per field.
 */
export async function createForm(
  context: ToolContext,
  args: CreateFormArgs
): Promise<CreateFormResult> {
  const { nodeMap, api } = context;
  const parent = nodeMap.get(args.parentId);
  if (!parent || !('appendChild' in parent)) {
    return { success: false, error: `createForm: parent "${args.parentId}" not found or not a container` };
  }

  if (!args.fields || args.fields.length === 0) {
    return { success: false, error: 'createForm: fields array is required and must not be empty' };
  }

  const formId = args.id ?? generateId('form');

  try {
    const sectionResult = createSection(context, {
      parentId: args.parentId,
      name: args.title ?? 'Form',
      direction: 'vertical',
      spacing: 'normal',
      id: formId,
    });
    if (!sectionResult.success) return sectionResult;

    if (args.title) {
      const titleResult = await addText(context, {
        parentId: formId,
        content: args.title,
        variant: 'h3',
        id: `${formId}_title`,
      });
      if (!titleResult.success) return titleResult;
    }

    for (let i = 0; i < args.fields.length; i++) {
      const field = args.fields[i];
      const inputResult = await createInput(context, {
        parentId: formId,
        label: field.label,
        placeholder: field.placeholder,
        id: `${formId}_input_${i}`,
      });
      if (!inputResult.success) return inputResult;
    }

    return { success: true, formId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// --- createCheckbox ---

export interface CreateCheckboxArgs {
  parentId: string;
  label?: string;
  checked?: boolean;
  id?: string;
}

export type CreateCheckboxResult =
  | { success: true; checkboxId: string }
  | { success: false; error: string };

const CHECKBOX_SIZE = 18;
const CHECKBOX_STROKE: SolidFill = { type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.52 }, opacity: 1 };
const CHECKBOX_CHECKED_FILL: SolidFill = { type: 'SOLID', color: { r: 0.2, g: 0.5, b: 0.9 }, opacity: 1 };

/**
 * Creates a checkbox: horizontal frame with small rectangle (box) and optional label.
 */
export async function createCheckbox(
  context: ToolContext,
  args: CreateCheckboxArgs
): Promise<CreateCheckboxResult> {
  const { nodeMap, api } = context;
  const parent = nodeMap.get(args.parentId);
  if (!parent || !('appendChild' in parent)) {
    return { success: false, error: `createCheckbox: parent "${args.parentId}" not found or not a container` };
  }

  const checkboxId = args.id ?? generateId('checkbox');
  const gap = 8;
  const rowHeight = 24;
  const label = args.label ?? '';

  try {
    createFrame(nodeMap, {
      id: checkboxId,
      name: `Checkbox: ${label.slice(0, 30)}`,
      width: CHECKBOX_SIZE + gap + (label ? 120 : 0),
      height: rowHeight,
      layoutMode: 'HORIZONTAL',
      itemSpacing: gap,
      paddingTop: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      paddingRight: 0,
    }, api);

    const boxId = generateId('checkbox_box');
    createRectangle(nodeMap, {
      id: boxId,
      name: 'Box',
      width: CHECKBOX_SIZE,
      height: CHECKBOX_SIZE,
      cornerRadius: 4,
      strokes: [CHECKBOX_STROKE],
      strokeWeight: 1,
      fills: args.checked ? [CHECKBOX_CHECKED_FILL] : undefined,
      x: 0,
      y: (rowHeight - CHECKBOX_SIZE) / 2,
    }, api);
    appendChild(nodeMap, checkboxId, boxId);

    if (label) {
      const textResult = await addText(context, {
        parentId: checkboxId,
        content: label,
        variant: 'small',
        id: `${checkboxId}_label`,
      });
      if (!textResult.success) return textResult;
    }

    appendChild(nodeMap, args.parentId, checkboxId);
    return { success: true, checkboxId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// --- createRadio ---

export interface CreateRadioArgs {
  parentId: string;
  label?: string;
  selected?: boolean;
  id?: string;
}

export type CreateRadioResult =
  | { success: true; radioId: string }
  | { success: false; error: string };

const RADIO_SIZE = 18;
const RADIO_STROKE: SolidFill = { type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.52 }, opacity: 1 };
const RADIO_SELECTED_FILL: SolidFill = { type: 'SOLID', color: { r: 0.2, g: 0.5, b: 0.9 }, opacity: 1 };

/**
 * Creates a radio option: horizontal frame with small ellipse (circle) and optional label.
 */
export async function createRadio(
  context: ToolContext,
  args: CreateRadioArgs
): Promise<CreateRadioResult> {
  const { nodeMap, api } = context;
  const parent = nodeMap.get(args.parentId);
  if (!parent || !('appendChild' in parent)) {
    return { success: false, error: `createRadio: parent "${args.parentId}" not found or not a container` };
  }

  const radioId = args.id ?? generateId('radio');
  const gap = 8;
  const rowHeight = 24;
  const label = args.label ?? '';

  try {
    createFrame(nodeMap, {
      id: radioId,
      name: `Radio: ${label.slice(0, 30)}`,
      width: RADIO_SIZE + gap + (label ? 120 : 0),
      height: rowHeight,
      layoutMode: 'HORIZONTAL',
      itemSpacing: gap,
      paddingTop: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      paddingRight: 0,
    }, api);

    const circleId = generateId('radio_circle');
    createEllipse(nodeMap, {
      id: circleId,
      name: 'Circle',
      width: RADIO_SIZE,
      height: RADIO_SIZE,
      strokes: [RADIO_STROKE],
      strokeWeight: 1,
      fills: args.selected ? [RADIO_SELECTED_FILL] : undefined,
      x: 0,
      y: (rowHeight - RADIO_SIZE) / 2,
    }, api);
    appendChild(nodeMap, radioId, circleId);

    if (label) {
      const textResult = await addText(context, {
        parentId: radioId,
        content: label,
        variant: 'small',
        id: `${radioId}_label`,
      });
      if (!textResult.success) return textResult;
    }

    appendChild(nodeMap, args.parentId, radioId);
    return { success: true, radioId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// --- createTextarea ---

export interface CreateTextareaArgs {
  parentId: string;
  label?: string;
  placeholder?: string;
  rows?: number;
  id?: string;
}

export type CreateTextareaResult =
  | { success: true; textareaId: string }
  | { success: false; error: string };

const TEXTAREA_MIN_ROWS = 2;
const TEXTAREA_MAX_ROWS = 8;
const TEXTAREA_ROW_HEIGHT = 24;
const TEXTAREA_WIDTH = 280;

/**
 * Creates a multi-line text field: optional label, stroke rectangle (taller than input), optional placeholder.
 */
export async function createTextarea(
  context: ToolContext,
  args: CreateTextareaArgs
): Promise<CreateTextareaResult> {
  const { nodeMap, api } = context;
  const parent = nodeMap.get(args.parentId);
  if (!parent || !('appendChild' in parent)) {
    return { success: false, error: `createTextarea: parent "${args.parentId}" not found or not a container` };
  }

  const textareaId = args.id ?? generateId('textarea');
  const labelGap = 4;
  const rows = Math.min(TEXTAREA_MAX_ROWS, Math.max(TEXTAREA_MIN_ROWS, args.rows ?? 3));
  const fieldHeight = rows * TEXTAREA_ROW_HEIGHT;
  const totalHeight = (args.label ? 12 + labelGap : 0) + fieldHeight;

  try {
    createFrame(nodeMap, {
      id: textareaId,
      name: `Textarea: ${(args.label || args.placeholder || 'Field').slice(0, 30)}`,
      width: TEXTAREA_WIDTH,
      height: totalHeight,
      layoutMode: 'VERTICAL',
      itemSpacing: labelGap,
      paddingTop: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      paddingRight: 0,
    }, api);

    if (args.label) {
      const labelResult = await addText(context, {
        parentId: textareaId,
        content: args.label,
        variant: 'small',
        id: `${textareaId}_label`,
      });
      if (!labelResult.success) return labelResult;
    }

    const fieldFrameId = generateId('textarea_field');
    createFrame(nodeMap, {
      id: fieldFrameId,
      name: 'Field',
      width: TEXTAREA_WIDTH,
      height: fieldHeight,
      layoutMode: 'NONE',
    }, api);

    const rectId = generateId('textarea_rect');
    createRectangle(nodeMap, {
      id: rectId,
      name: 'Border',
      width: TEXTAREA_WIDTH,
      height: fieldHeight,
      cornerRadius: 4,
      strokes: [INPUT_STROKE],
      strokeWeight: 1,
      x: 0,
      y: 0,
    }, api);
    appendChild(nodeMap, fieldFrameId, rectId);

    if (args.placeholder) {
      await loadFont('Inter', 'Regular', api);
      const phTextId = generateId('textarea_ph');
      await createText(nodeMap, {
        id: phTextId,
        name: 'Placeholder',
        characters: args.placeholder,
        fontSize: 12,
        fontFamily: 'Inter',
        fontStyle: 'Regular',
        fills: [INPUT_PLACEHOLDER_FILL],
        x: 8,
        y: 8,
      }, api);
      appendChild(nodeMap, fieldFrameId, phTextId);
    }

    appendChild(nodeMap, textareaId, fieldFrameId);
    appendChild(nodeMap, args.parentId, textareaId);
    return { success: true, textareaId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// --- createTable ---

const TABLE_MAX_COLUMNS = 10;
const TABLE_MAX_ROWS = 20;
const TABLE_ROW_HEIGHT = 32;
const TABLE_CELL_PADDING = 8;
const TABLE_CELL_MIN_WIDTH = 60;

export interface CreateTableArgs {
  parentId: string;
  columns: number;
  rows: number;
  headerRow?: string[];
  cellTexts?: string[][];
  id?: string;
}

export type CreateTableResult =
  | { success: true; tableId: string }
  | { success: false; error: string };

/**
 * Creates a table: frame (vertical) with one row frame (horizontal) per row, each cell is a frame with text.
 * columns/rows are limited to TABLE_MAX_COLUMNS / TABLE_MAX_ROWS.
 */
export async function createTable(
  context: ToolContext,
  args: CreateTableArgs
): Promise<CreateTableResult> {
  const { nodeMap, api } = context;
  const parent = nodeMap.get(args.parentId);
  if (!parent || !('appendChild' in parent)) {
    return { success: false, error: `createTable: parent "${args.parentId}" not found or not a container` };
  }

  const cols = Math.max(1, Math.min(TABLE_MAX_COLUMNS, args.columns));
  const rowCount = Math.max(1, Math.min(TABLE_MAX_ROWS, args.rows));
  const tableId = args.id ?? generateId('table');
  const cellWidth = Math.max(TABLE_CELL_MIN_WIDTH, Math.round(400 / cols));
  const tableWidth = cols * cellWidth;

  try {
    await loadFont('Inter', 'Regular', api);

    createFrame(nodeMap, {
      id: tableId,
      name: `Table ${cols}x${rowCount}`,
      width: tableWidth,
      height: rowCount * TABLE_ROW_HEIGHT,
      layoutMode: 'VERTICAL',
      itemSpacing: 0,
      paddingTop: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      paddingRight: 0,
    }, api);

    const headerRow = args.headerRow ?? Array.from({ length: cols }, (_, i) => `Col ${i + 1}`);
    const cellTexts = args.cellTexts ?? [];

    for (let r = 0; r < rowCount; r++) {
      const rowId = generateId(`table_row_${r}`);
      createFrame(nodeMap, {
        id: rowId,
        name: `Row ${r}`,
        width: tableWidth,
        height: TABLE_ROW_HEIGHT,
        layoutMode: 'HORIZONTAL',
        itemSpacing: 0,
        paddingTop: 0,
        paddingBottom: 0,
        paddingLeft: 0,
        paddingRight: 0,
      }, api);

      const cellContent = r === 0 ? headerRow : (cellTexts[r - 1] ?? Array.from({ length: cols }, (_, i) => `Zelle ${r}-${i + 1}`));
      const isHeader = r === 0;

      for (let c = 0; c < cols; c++) {
        const cellId = generateId(`table_cell_${r}_${c}`);
        const text = (cellContent[c] ?? '').toString();
        createFrame(nodeMap, {
          id: cellId,
          name: `Cell ${r}-${c}`,
          width: cellWidth,
          height: TABLE_ROW_HEIGHT,
          layoutMode: 'NONE',
        }, api);

        const textId = generateId(`table_text_${r}_${c}`);
        const fill: SolidFill = isHeader
          ? { type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2 }, opacity: 1 }
          : { type: 'SOLID', color: { r: 0.35, g: 0.35, b: 0.35 }, opacity: 1 };
        await createText(nodeMap, {
          id: textId,
          name: 'Cell text',
          characters: text || ' ',
          fontSize: isHeader ? 12 : 11,
          fontFamily: 'Inter',
          fontStyle: isHeader ? 'Semi Bold' : 'Regular',
          fills: [fill],
          textAutoResize: 'HEIGHT',
          x: TABLE_CELL_PADDING,
          y: Math.round((TABLE_ROW_HEIGHT - (isHeader ? 12 : 11)) / 2),
        }, api);
        appendChild(nodeMap, cellId, textId);
        appendChild(nodeMap, rowId, cellId);
      }

      appendChild(nodeMap, tableId, rowId);
    }

    appendChild(nodeMap, args.parentId, tableId);
    return { success: true, tableId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// --- createList ---

export interface CreateListArgs {
  parentId: string;
  items: string[];
  variant?: 'bullet' | 'numbered' | 'plain';
  id?: string;
}

export type CreateListResult =
  | { success: true; listId: string }
  | { success: false; error: string };

const LIST_ITEM_SPACING = 6;
const LIST_ROW_GAP = 8;
const BULLET_SIZE = 6;
const BULLET_FILL: SolidFill = { type: 'SOLID', color: { r: 0.3, g: 0.3, b: 0.32 }, opacity: 1 };

/**
 * Creates a list: vertical frame with one row per item. variant bullet = small ellipse, numbered = "1." "2." …, plain = text only.
 */
export async function createList(
  context: ToolContext,
  args: CreateListArgs
): Promise<CreateListResult> {
  const { nodeMap, api } = context;
  const parent = nodeMap.get(args.parentId);
  if (!parent || !('appendChild' in parent)) {
    return { success: false, error: `createList: parent "${args.parentId}" not found or not a container` };
  }

  if (!args.items || args.items.length === 0) {
    return { success: false, error: 'createList: items array is required and must not be empty' };
  }

  const listId = args.id ?? generateId('list');
  const variant = args.variant ?? 'bullet';

  try {
    await loadFont('Inter', 'Regular', api);

    createFrame(nodeMap, {
      id: listId,
      name: `List ${args.items.length} items`,
      width: 320,
      height: args.items.length * (20 + LIST_ITEM_SPACING) - LIST_ITEM_SPACING,
      layoutMode: 'VERTICAL',
      itemSpacing: LIST_ITEM_SPACING,
      paddingTop: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      paddingRight: 0,
    }, api);

    for (let i = 0; i < args.items.length; i++) {
      const rowId = generateId(`list_row_${i}`);
      const itemText = args.items[i] ?? '';
      createFrame(nodeMap, {
        id: rowId,
        name: `List item ${i + 1}`,
        width: 320,
        height: 20,
        layoutMode: 'HORIZONTAL',
        itemSpacing: LIST_ROW_GAP,
        paddingTop: 0,
        paddingBottom: 0,
        paddingLeft: 0,
        paddingRight: 0,
      }, api);

      if (variant === 'bullet') {
        const bulletId = generateId(`list_bullet_${i}`);
        createEllipse(nodeMap, {
          id: bulletId,
          name: 'Bullet',
          width: BULLET_SIZE,
          height: BULLET_SIZE,
          fills: [BULLET_FILL],
          x: 0,
          y: (20 - BULLET_SIZE) / 2,
        }, api);
        appendChild(nodeMap, rowId, bulletId);
      } else if (variant === 'numbered') {
        const numId = generateId(`list_num_${i}`);
        await createText(nodeMap, {
          id: numId,
          name: 'Number',
          characters: `${i + 1}.`,
          fontSize: 12,
          fontFamily: 'Inter',
          fontStyle: 'Regular',
          fills: [{ type: 'SOLID', color: { r: 0.35, g: 0.35, b: 0.35 }, opacity: 1 }],
          textAutoResize: 'HEIGHT',
          x: 0,
          y: 4,
        }, api);
        appendChild(nodeMap, rowId, numId);
      }

      const textResult = await addText(context, {
        parentId: rowId,
        content: itemText,
        variant: 'body',
        id: `${listId}_item_${i}`,
      });
      if (!textResult.success) return textResult;

      appendChild(nodeMap, listId, rowId);
    }

    appendChild(nodeMap, args.parentId, listId);
    return { success: true, listId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// --- createHeader ---

export interface CreateHeaderArgs {
  parentId: string;
  logoLabel?: string;
  navItems?: string[];
  ctaLabel?: string;
  id?: string;
}

export type CreateHeaderResult =
  | { success: true; headerId: string }
  | { success: false; error: string };

const HEADER_LOGO_WIDTH = 80;
const HEADER_LOGO_HEIGHT = 32;
const HEADER_NAV_GAP = 24;

/**
 * Creates a header section: horizontal section with logo placeholder, nav items (addText), and optional CTA button.
 */
export async function createHeader(
  context: ToolContext,
  args: CreateHeaderArgs
): Promise<CreateHeaderResult> {
  const { nodeMap, api } = context;
  const parent = nodeMap.get(args.parentId);
  if (!parent || !('appendChild' in parent)) {
    return { success: false, error: `createHeader: parent "${args.parentId}" not found or not a container` };
  }

  const headerId = args.id ?? generateId('header');

  try {
    const sectionResult = createSection(context, {
      parentId: args.parentId,
      direction: 'horizontal',
      spacing: 'normal',
      width: 800,
      height: 64,
      align: 'center',
      id: headerId,
    });
    if (!sectionResult.success) return sectionResult;

    if (args.logoLabel != null && args.logoLabel !== '') {
      const logoRectId = generateId('header_logo');
      createRectangle(nodeMap, {
        id: logoRectId,
        name: 'Logo',
        width: HEADER_LOGO_WIDTH,
        height: HEADER_LOGO_HEIGHT,
        fills: [{ type: 'SOLID', color: { r: 0.92, g: 0.92, b: 0.94 }, opacity: 1 }],
        cornerRadius: 4,
        x: 0,
        y: 0,
      }, api);
      appendChild(nodeMap, headerId, logoRectId);
      const logoTextResult = await addText(context, {
        parentId: headerId,
        content: args.logoLabel,
        variant: 'small',
        id: generateId('header_logo_text'),
      });
      if (!logoTextResult.success) return logoTextResult;
    } else {
      const logoRectId = generateId('header_logo');
      createRectangle(nodeMap, {
        id: logoRectId,
        name: 'Logo',
        width: HEADER_LOGO_WIDTH,
        height: HEADER_LOGO_HEIGHT,
        fills: [{ type: 'SOLID', color: { r: 0.92, g: 0.92, b: 0.94 }, opacity: 1 }],
        cornerRadius: 4,
        x: 0,
        y: 0,
      }, api);
      appendChild(nodeMap, headerId, logoRectId);
    }

    const navItems = args.navItems ?? [];
    for (const label of navItems) {
      const t = await addText(context, {
        parentId: headerId,
        content: label,
        variant: 'body',
        id: generateId('header_nav'),
      });
      if (!t.success) return t;
    }

    if (args.ctaLabel != null && args.ctaLabel !== '') {
      const btnResult = await createButton(context, {
        parentId: headerId,
        label: args.ctaLabel,
        variant: 'primary',
        id: generateId('header_cta'),
      });
      if (!btnResult.success) return btnResult;
    }

    return { success: true, headerId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// --- createHero ---

export interface CreateHeroArgs {
  parentId: string;
  title: string;
  subtitle?: string;
  imageLabel?: string;
  ctaLabel?: string;
  id?: string;
}

export type CreateHeroResult =
  | { success: true; heroId: string }
  | { success: false; error: string };

/**
 * Creates a hero block: vertical section with h1 title, optional subtitle, optional image placeholder, optional CTA button row.
 */
export async function createHero(
  context: ToolContext,
  args: CreateHeroArgs
): Promise<CreateHeroResult> {
  const { nodeMap } = context;
  const parent = nodeMap.get(args.parentId);
  if (!parent || !('appendChild' in parent)) {
    return { success: false, error: `createHero: parent "${args.parentId}" not found or not a container` };
  }

  if (!args.title || args.title.trim() === '') {
    return { success: false, error: 'createHero: title is required' };
  }

  const heroId = args.id ?? generateId('hero');

  try {
    const sectionResult = createSection(context, {
      parentId: args.parentId,
      direction: 'vertical',
      spacing: 'spacious',
      width: 600,
      height: 400,
      id: heroId,
    });
    if (!sectionResult.success) return sectionResult;

    const titleResult = await addText(context, {
      parentId: heroId,
      content: args.title,
      variant: 'h1',
      id: generateId('hero_title'),
    });
    if (!titleResult.success) return titleResult;

    if (args.subtitle != null && args.subtitle !== '') {
      const subResult = await addText(context, {
        parentId: heroId,
        content: args.subtitle,
        variant: 'body',
        id: generateId('hero_subtitle'),
      });
      if (!subResult.success) return subResult;
    }

    if (args.imageLabel != null && args.imageLabel !== '') {
      const imgResult = await addPlaceholderImage(context, {
        parentId: heroId,
        width: 560,
        height: 280,
        label: args.imageLabel,
        id: generateId('hero_image'),
      });
      if (!imgResult.success) return imgResult;
    }

    if (args.ctaLabel != null && args.ctaLabel !== '') {
      const rowResult = await createButtonRow(context, {
        parentId: heroId,
        buttons: [{ label: args.ctaLabel, variant: 'primary' }],
        id: generateId('hero_cta'),
      });
      if (!rowResult.success) return rowResult;
    }

    return { success: true, heroId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// --- addText ---

export interface AddTextArgs {
  parentId: string;
  content: string;
  variant?: 'h1' | 'h2' | 'h3' | 'body' | 'small' | 'caption';
  align?: 'left' | 'center' | 'right';
  id?: string;
}

export type AddTextResult =
  | { success: true; textId: string }
  | { success: false; error: string };

const TEXT_VARIANT_FONT: Record<string, { size: number; family: string; style: string }> = {
  h1: { size: 24, family: 'Inter', style: 'Bold' },
  h2: { size: 20, family: 'Inter', style: 'Bold' },
  h3: { size: 18, family: 'Inter', style: 'Semi Bold' },
  body: { size: 14, family: 'Inter', style: 'Regular' },
  small: { size: 12, family: 'Inter', style: 'Regular' },
  caption: { size: 11, family: 'Inter', style: 'Regular' },
};

/**
 * Adds a text node to an existing container. Uses loadFont + createText + appendChild.
 */
export async function addText(
  context: ToolContext,
  args: AddTextArgs
): Promise<AddTextResult> {
  const { nodeMap, api } = context;
  const parent = nodeMap.get(args.parentId);
  if (!parent || !('appendChild' in parent)) {
    return { success: false, error: `addText: parent "${args.parentId}" not found or not a container` };
  }

  const variant = args.variant ?? 'body';
  const font = TEXT_VARIANT_FONT[variant] ?? TEXT_VARIANT_FONT.body;
  const textId = args.id ?? generateId('text');

  try {
    await loadFont(font.family, font.style, api);
    const fill: SolidFill = { type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2 }, opacity: 1 };
    await createText(nodeMap, {
      id: textId,
      name: `Text: ${(args.content || '').slice(0, 30)}`,
      characters: args.content || '',
      fontSize: font.size,
      fontFamily: font.family,
      fontStyle: font.style,
      fills: [fill],
      textAlignHorizontal: args.align === 'center' ? 'CENTER' : args.align === 'right' ? 'RIGHT' : 'LEFT',
      textAutoResize: 'HEIGHT',
    }, api);

    appendChild(nodeMap, args.parentId, textId);
    return { success: true, textId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// --- addSvg ---

export interface AddSvgArgs {
  parentId: string;
  /** Full SVG markup, e.g. "<svg>...</svg>". The agent can write simple SVG code. */
  svgCode: string;
  width?: number;
  height?: number;
  id?: string;
}

export type AddSvgResult =
  | { success: true; svgId: string }
  | { success: false; error: string };

/**
 * Adds an SVG node from raw SVG code (figma.createNodeFromSvg). Use for icons or simple vector graphics.
 * Optionally resize the resulting frame with width/height.
 */
export function addSvg(
  context: ToolContext,
  args: AddSvgArgs
): AddSvgResult {
  const { nodeMap, api } = context;
  const parent = nodeMap.get(args.parentId);
  if (!parent || !('appendChild' in parent)) {
    return { success: false, error: `addSvg: parent "${args.parentId}" not found or not a container` };
  }

  const svgResult = createSvgNode(nodeMap, args.svgCode, args.id ?? generateId('svg'), api);
  if (!svgResult.success) return svgResult;

  const svgId = svgResult.nodeId;
  const node = nodeMap.get(svgId);
  if (node && args.width != null && args.height != null && 'resize' in node) {
    (node as { resize: (w: number, h: number) => void }).resize(args.width, args.height);
  } else if (node && (args.width != null || args.height != null) && 'resize' in node) {
    const w = args.width ?? (node as { width: number }).width ?? 24;
    const h = args.height ?? (node as { height: number }).height ?? 24;
    (node as { resize: (w: number, h: number) => void }).resize(w, h);
  }

  appendChild(nodeMap, args.parentId, svgId);
  return { success: true, svgId };
}

// --- addPlaceholderImage ---

export interface AddPlaceholderImageArgs {
  parentId: string;
  width?: number;
  height?: number;
  /** Short description of the desired image, e.g. "image:produktdetailbild des autos". Shown centered on the placeholder. */
  label?: string;
  id?: string;
}

export type AddPlaceholderImageResult =
  | { success: true; placeholderId: string }
  | { success: false; error: string };

const PLACEHOLDER_FILL: SolidFill = { type: 'SOLID', color: { r: 0.88, g: 0.88, b: 0.88 }, opacity: 1 };

/** Default label prefix for image placeholders so it's clear what the field describes. */
export const PLACEHOLDER_IMAGE_LABEL_PREFIX = 'image:';

/**
 * Adds an image placeholder: gray rectangle with a centered label describing the desired image (e.g. "image:produktdetailbild des autos").
 * Always uses a wrapper frame (layoutMode NONE) so the label is overlaid in the center.
 */
export async function addPlaceholderImage(
  context: ToolContext,
  args: AddPlaceholderImageArgs
): Promise<AddPlaceholderImageResult> {
  const { nodeMap, api } = context;
  const parent = nodeMap.get(args.parentId);
  if (!parent || !('appendChild' in parent)) {
    return { success: false, error: `addPlaceholderImage: parent "${args.parentId}" not found or not a container` };
  }

  const width = args.width ?? 320;
  const height = args.height ?? 180;
  const placeholderId = args.id ?? generateId('placeholder');
  const label = args.label != null && args.label !== ''
    ? (args.label.startsWith(PLACEHOLDER_IMAGE_LABEL_PREFIX) ? args.label : `${PLACEHOLDER_IMAGE_LABEL_PREFIX}${args.label}`)
    : `${PLACEHOLDER_IMAGE_LABEL_PREFIX}Bild`;

  try {
    const frameId = placeholderId;
    createFrame(nodeMap, {
      id: frameId,
      name: `Placeholder: ${label.slice(0, 40)}`,
      width,
      height,
      layoutMode: 'NONE',
    }, api);
    const rectId = generateId('ph_rect');
    createRectangle(nodeMap, {
      id: rectId,
      name: 'Image area',
      width,
      height,
      fills: [PLACEHOLDER_FILL],
      cornerRadius: 4,
      x: 0,
      y: 0,
    }, api);
    appendChild(nodeMap, frameId, rectId);

    await loadFont('Inter', 'Regular', api);
    const textId = generateId('ph_label');
    const textFill: SolidFill = { type: 'SOLID', color: { r: 0.45, g: 0.45, b: 0.45 }, opacity: 1 };
    const labelWidth = Math.max(80, width - 24);
    const labelHeight = 36;
    await createText(nodeMap, {
      id: textId,
      name: 'Label',
      characters: label,
      fontSize: 11,
      fontFamily: 'Inter',
      fontStyle: 'Regular',
      fills: [textFill],
      textAlignHorizontal: 'CENTER',
      textAutoResize: 'NONE',
      x: Math.round((width - labelWidth) / 2),
      y: Math.round((height - labelHeight) / 2),
    }, api);
    const textNode = nodeMap.get(textId);
    if (textNode && 'resize' in textNode) {
      (textNode as { resize: (w: number, h: number) => void }).resize(labelWidth, labelHeight);
    }
    appendChild(nodeMap, frameId, textId);
    appendChild(nodeMap, args.parentId, frameId);

    return { success: true, placeholderId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// --- createCard ---

export interface CreateCardArgs {
  parentId: string;
  title: string;
  description?: string;
  buttonLabel?: string;
  placeholderHeight?: number;
  id?: string;
}

export type CreateCardResult =
  | { success: true; cardId: string }
  | { success: false; error: string };

/**
 * Creates a card: frame with placeholder image, title, description, and optional CTA button.
 */
export async function createCard(
  context: ToolContext,
  args: CreateCardArgs
): Promise<CreateCardResult> {
  const { nodeMap, api } = context;
  const parent = nodeMap.get(args.parentId);
  if (!parent || !('appendChild' in parent)) {
    return { success: false, error: `createCard: parent "${args.parentId}" not found or not a container` };
  }

  const cardId = args.id ?? generateId('card');
  const phHeight = args.placeholderHeight ?? 140;

  try {
    createFrame(nodeMap, {
      id: cardId,
      name: `Card: ${args.title.slice(0, 30)}`,
      width: 280,
      height: 320,
      layoutMode: 'VERTICAL',
      itemSpacing: 12,
      paddingTop: 16,
      paddingBottom: 16,
      paddingLeft: 16,
      paddingRight: 16,
    }, api);

    const phResult = await addPlaceholderImage(
      context,
      { parentId: cardId, width: 248, height: phHeight, label: 'Bild', id: `${cardId}_ph` }
    );
    if (!phResult.success) return phResult;

    const titleResult = await addText(context, {
      parentId: cardId,
      content: args.title,
      variant: 'h3',
      id: `${cardId}_title`,
    });
    if (!titleResult.success) return titleResult;

    if (args.description) {
      const descResult = await addText(context, {
        parentId: cardId,
        content: args.description,
        variant: 'body',
        id: `${cardId}_desc`,
      });
      if (!descResult.success) return descResult;
    }

    if (args.buttonLabel) {
      const btnResult = await createButton(context, {
        parentId: cardId,
        label: args.buttonLabel,
        variant: 'outline',
        width: 120,
        id: `${cardId}_btn`,
      });
      if (!btnResult.success) return btnResult;
    }

    appendChild(nodeMap, args.parentId, cardId);
    return { success: true, cardId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
