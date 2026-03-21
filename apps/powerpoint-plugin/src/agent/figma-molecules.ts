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
import { tokens, fillFromToken } from './design-tokens';
import type { SpacingPreset } from './design-tokens';

/** Optional map of token key -> Figma Variable for binding (e.g. "colors-primary", "radius-md"). Set when running in plugin after getOrCreateWireframeVariables(). */
export type WireframeVariableMap = Record<string, unknown>;

/** Minimal Figma variables API for binding (from plugin: figma.variables). */
export type FigmaVariablesApi = {
  setBoundVariableForPaint: (paint: unknown, field: string, variable: unknown) => unknown;
};

export interface ToolContext {
  nodeMap: NodeMap;
  api?: FigmaApiLike | null;
  /** When set, molecules can bind node properties (fills, cornerRadius, etc.) to these Figma variables. */
  variables?: WireframeVariableMap | null;
  /** When set (in plugin), use for setBoundVariableForPaint so bindings apply. */
  variablesApi?: FigmaVariablesApi | null;
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

function buttonFillsForVariant(variant: 'primary' | 'secondary' | 'outline'): SolidFill[] | undefined {
  switch (variant) {
    case 'primary':
      return [fillFromToken(tokens.colors.primary)];
    case 'secondary':
      return [fillFromToken(tokens.colors.secondary)];
    case 'outline':
      return undefined;
    default:
      return [fillFromToken(tokens.colors.primary)];
  }
}

function buttonStrokesForVariant(variant: 'primary' | 'secondary' | 'outline'): SolidFill[] | undefined {
  if (variant === 'outline') {
    return [fillFromToken(tokens.colors.border)];
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
  const width = args.width ?? tokens.sizing.buttonMinWidth;
  const height = tokens.sizing.buttonHeight;
  const paddingX = tokens.sizing.buttonPaddingX;
  const buttonId = args.id ?? generateId('btn');
  const innerId = `${buttonId}_inner`;

  try {
    // 1. Outer frame with padding (so we can bind tw-spacing-3 to padding in Figma)
    const paddingVar = context.variables?.['spacing-3'];
    createFrame(nodeMap, {
      id: buttonId,
      name: `Button: ${args.label}`,
      width,
      height,
      layoutMode: 'HORIZONTAL',
      paddingLeft: paddingX,
      paddingRight: paddingX,
      paddingLeftVariable: paddingVar,
      paddingRightVariable: paddingVar,
    }, api);

    // 2. Inner frame (NONE) so rect and text can overlap
    createFrame(nodeMap, {
      id: innerId,
      name: 'Button content',
      width: width - paddingX * 2,
      height,
      layoutMode: 'NONE',
    }, api);

    // 3. Rectangle for background (bind to Figma variables)
    const rectId = generateId('btn_rect');
    const fillVar = variant === 'primary' ? context.variables?.['colors-primary'] : context.variables?.['colors-secondary'];
    const radiusVar = context.variables?.['radius-md'];
    createRectangle(nodeMap, {
      id: rectId,
      name: 'Button background',
      width: width - paddingX * 2,
      height,
      fills: buttonFillsForVariant(variant),
      strokes: buttonStrokesForVariant(variant),
      strokeWeight: variant === 'outline' ? 1 : undefined,
      cornerRadius: tokens.radius.md,
      fillVariable: fillVar,
      cornerRadiusVariable: radiusVar,
      _variablesApi: context.variablesApi ?? undefined,
    }, api);

    // 4. Text label
    await loadFont('Inter', 'Regular', api);
    const textId = generateId('btn_text');
    const textFill: SolidFill = variant === 'primary'
      ? fillFromToken(tokens.colors.primaryForeground)
      : fillFromToken(tokens.colors.secondaryForeground);
    const bodySize = tokens.typography.body.fontSize;
    await createText(nodeMap, {
      id: textId,
      name: 'Button label',
      characters: args.label,
      fontSize: bodySize,
      fontFamily: tokens.typography.fontFamily,
      fontStyle: tokens.typography.body.fontStyle,
      fills: [textFill],
      textAutoResize: 'HEIGHT',
      x: 0,
      y: (height - bodySize) / 2,
    }, api);

    // 5. Hierarchy: rect + text -> inner frame -> button frame -> parent
    appendChild(nodeMap, innerId, rectId);
    appendChild(nodeMap, innerId, textId);
    appendChild(nodeMap, buttonId, innerId);
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
  const gap = args.gap ?? tokens.spacing[3];
  const buttonRowId = args.id ?? generateId('button_row');
  const defaultBtnWidth = tokens.sizing.buttonMinWidth;
  const btnHeight = tokens.sizing.buttonHeight;
  const n = args.buttons.length;
  const rowWidth = direction === 'horizontal'
    ? n * defaultBtnWidth + (n - 1) * gap
    : defaultBtnWidth;
  const rowHeight = direction === 'horizontal'
    ? btnHeight
    : n * btnHeight + (n - 1) * gap;

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

  const iconSize = args.iconSize ?? tokens.sizing.iconSize;
  const height = tokens.sizing.buttonHeight;
  const paddingX = tokens.sizing.buttonPaddingX;
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
        cornerRadius: tokens.radius.md,
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

    const gap = tokens.spacing[2];
    await loadFont(tokens.typography.fontFamily, tokens.typography.body.fontStyle, api);
    const textId = generateId('icon_btn_text');
    const textFill: SolidFill = args.variant === 'primary'
      ? fillFromToken(tokens.colors.primaryForeground)
      : fillFromToken(tokens.colors.secondaryForeground);
    await createText(nodeMap, {
      id: textId,
      name: 'Label',
      characters: args.label!,
      fontSize: tokens.typography.body.fontSize,
      fontFamily: tokens.typography.fontFamily,
      fontStyle: tokens.typography.body.fontStyle,
      fills: [textFill],
      textAutoResize: 'HEIGHT',
    }, api);
    const textNode = nodeMap.get(textId);
    const textW = textNode && 'width' in textNode ? (textNode as { width: number }).width : 60;
    const width = paddingX + iconSize + gap + textW + paddingX;
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
      cornerRadius: tokens.radius.md,
    }, api);
    const svgResult = createSvgNode(nodeMap, args.iconSvg!.trim(), generateId('icon_btn_svg'), api);
    if (!svgResult.success) return svgResult;
    const svgNode = nodeMap.get(svgResult.nodeId);
    if (svgNode && 'resize' in svgNode) {
      (svgNode as { resize: (w: number, h: number) => void }).resize(iconSize, iconSize);
    }
    if (svgNode && 'x' in svgNode && 'y' in svgNode) {
      (svgNode as { x: number; y: number }).x = paddingX;
      (svgNode as { x: number; y: number }).y = (height - iconSize) / 2;
    }
    if (textNode && 'x' in textNode && 'y' in textNode) {
      (textNode as { x: number; y: number }).x = paddingX + iconSize + gap;
      (textNode as { y: number }).y = (height - tokens.typography.body.fontSize) / 2;
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
  const preset = args.spacing ? tokens.sectionPresets[args.spacing] : null;
  const gap = args.gap ?? preset?.gap ?? 16;
  const padding = args.padding ?? preset?.padding ?? 20;
  const sectionId = args.id ?? generateId('section');
  const parentWidth = parent && 'width' in parent ? (parent as { width: number }).width : 400;
  const sectionWidth = args.width ?? parentWidth;

  const counterAxisAlign = args.align === 'center' ? 'CENTER' as const : args.align === 'max' ? 'MAX' as const : args.align === 'min' ? 'MIN' as const : undefined;

  try {
    createFrame(nodeMap, {
      id: sectionId,
      name: args.name ?? `Section ${sectionId}`,
      width: sectionWidth,
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
  const parentWidth = parent && 'width' in parent ? (parent as { width: number }).width : 800;

  try {
    createFrame(nodeMap, {
      id: rowId,
      name: args.name ?? `Row ${rowId}`,
      width: parentWidth,
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
  const parentWidth = parent && 'width' in parent ? (parent as { width: number }).width : 0;
  const defaultLength = orientation === 'horizontal' && parentWidth >= 200 ? parentWidth - 40 : 200;
  const length = args.length ?? defaultLength;
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
      strokes: [fillFromToken(tokens.colors.border)],
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

  const size = args.size ?? tokens.sizing.avatarSize;
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
      fills: [fillFromToken(tokens.colors.avatar)],
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
      fills: [fillFromToken(tokens.colors.primaryForeground)],
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
  const labelGap = tokens.spacing[1];
  const inputHeight = tokens.sizing.inputHeight;
  const inputWidth = tokens.sizing.inputWidth;
  const totalHeight = (args.label ? tokens.typography.small.fontSize + labelGap : 0) + inputHeight;

  try {
    createFrame(nodeMap, {
      id: inputId,
      name: `Input: ${(args.label || args.placeholder || 'Field').slice(0, 30)}`,
      width: inputWidth,
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
      width: inputWidth,
      height: inputHeight,
      layoutMode: 'NONE',
    }, api);

    const rectId = generateId('input_rect');
    createRectangle(nodeMap, {
      id: rectId,
      name: 'Border',
      width: inputWidth,
      height: inputHeight,
      cornerRadius: tokens.radius.sm,
      strokes: [fillFromToken(tokens.colors.input)],
      strokeWeight: 1,
      x: 0,
      y: 0,
    }, api);
    appendChild(nodeMap, fieldFrameId, rectId);

    if (args.placeholder) {
      await loadFont(tokens.typography.fontFamily, tokens.typography.body.fontStyle, api);
      const phTextId = generateId('input_ph');
      await createText(nodeMap, {
        id: phTextId,
        name: 'Placeholder',
        characters: args.placeholder,
        fontSize: 12,
        fontFamily: 'Inter',
        fontStyle: 'Regular',
        fills: [fillFromToken(tokens.colors.placeholder)],
        x: tokens.spacing[2],
        y: Math.round((inputHeight - tokens.typography.small.fontSize) / 2),
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
      width: tokens.sizing.checkboxSize + gap + (label ? 120 : 0),
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
      width: tokens.sizing.checkboxSize,
      height: tokens.sizing.checkboxSize,
      cornerRadius: 4,
      strokes: [CHECKBOX_STROKE],
      strokeWeight: 1,
      fills: args.checked ? [CHECKBOX_CHECKED_FILL] : undefined,
      x: 0,
      y: (rowHeight - tokens.sizing.checkboxSize) / 2,
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
      width: tokens.sizing.radioSize + gap + (label ? 120 : 0),
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
      width: tokens.sizing.radioSize,
      height: tokens.sizing.radioSize,
      strokes: [RADIO_STROKE],
      strokeWeight: 1,
      fills: args.selected ? [RADIO_SELECTED_FILL] : undefined,
      x: 0,
      y: (rowHeight - tokens.sizing.radioSize) / 2,
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
  const labelGap = tokens.spacing[1];
  const tw = tokens.sizing.textareaWidth;
  const rowH = tokens.sizing.textareaRowHeight;
  const rows = Math.min(tokens.sizing.textareaMaxRows, Math.max(tokens.sizing.textareaMinRows, args.rows ?? 3));
  const fieldHeight = rows * rowH;
  const totalHeight = (args.label ? tokens.typography.small.fontSize + labelGap : 0) + fieldHeight;

  try {
    createFrame(nodeMap, {
      id: textareaId,
      name: `Textarea: ${(args.label || args.placeholder || 'Field').slice(0, 30)}`,
      width: tw,
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
      width: tw,
      height: fieldHeight,
      layoutMode: 'NONE',
    }, api);

    const rectId = generateId('textarea_rect');
    createRectangle(nodeMap, {
      id: rectId,
      name: 'Border',
      width: tw,
      height: fieldHeight,
      cornerRadius: tokens.radius.sm,
      strokes: [fillFromToken(tokens.colors.input)],
      strokeWeight: 1,
      x: 0,
      y: 0,
    }, api);
    appendChild(nodeMap, fieldFrameId, rectId);

    if (args.placeholder) {
      await loadFont(tokens.typography.fontFamily, tokens.typography.body.fontStyle, api);
      const phTextId = generateId('textarea_ph');
      await createText(nodeMap, {
        id: phTextId,
        name: 'Placeholder',
        characters: args.placeholder,
        fontSize: tokens.typography.small.fontSize,
        fontFamily: tokens.typography.fontFamily,
        fontStyle: tokens.typography.small.fontStyle,
        fills: [fillFromToken(tokens.colors.placeholder)],
        x: tokens.spacing[2],
        y: tokens.spacing[2],
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
  const cellWidth = Math.max(tokens.sizing.tableCellMinWidth, Math.round(400 / cols));
  const tableWidth = cols * cellWidth;

  try {
    await loadFont(tokens.typography.fontFamily, tokens.typography.body.fontStyle, api);

    createFrame(nodeMap, {
      id: tableId,
      name: `Table ${cols}x${rowCount}`,
      width: tableWidth,
      height: rowCount * tokens.sizing.tableRowHeight,
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
        height: tokens.sizing.tableRowHeight,
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
          height: tokens.sizing.tableRowHeight,
          layoutMode: 'NONE',
        }, api);

        const textId = generateId(`table_text_${r}_${c}`);
        const cellFontSize = isHeader ? tokens.typography.small.fontSize : tokens.typography.caption.fontSize;
        await createText(nodeMap, {
          id: textId,
          name: 'Cell text',
          characters: text || ' ',
          fontSize: cellFontSize,
          fontFamily: tokens.typography.fontFamily,
          fontStyle: isHeader ? tokens.typography.h3.fontStyle : tokens.typography.body.fontStyle,
          fills: [fillFromToken(isHeader ? tokens.colors.foreground : tokens.colors.mutedForeground)],
          textAutoResize: 'HEIGHT',
          x: tokens.spacing[2],
          y: Math.round((tokens.sizing.tableRowHeight - cellFontSize) / 2),
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
    await loadFont(tokens.typography.fontFamily, tokens.typography.body.fontStyle, api);

    createFrame(nodeMap, {
      id: listId,
      name: `List ${args.items.length} items`,
      width: 320,
      height: args.items.length * (tokens.sizing.listItemHeight + tokens.sizing.listItemSpacing) - tokens.sizing.listItemSpacing,
      layoutMode: 'VERTICAL',
      itemSpacing: tokens.sizing.listItemSpacing,
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
        height: tokens.sizing.listItemHeight,
        layoutMode: 'HORIZONTAL',
        itemSpacing: tokens.spacing[2],
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
          width: tokens.sizing.bulletSize,
          height: tokens.sizing.bulletSize,
          fills: [fillFromToken(tokens.colors.foreground)],
          x: 0,
          y: (tokens.sizing.listItemHeight - tokens.sizing.bulletSize) / 2,
        }, api);
        appendChild(nodeMap, rowId, bulletId);
      } else if (variant === 'numbered') {
        const numId = generateId(`list_num_${i}`);
        await createText(nodeMap, {
          id: numId,
          name: 'Number',
          characters: `${i + 1}.`,
          fontSize: tokens.typography.small.fontSize,
          fontFamily: tokens.typography.fontFamily,
          fontStyle: tokens.typography.small.fontStyle,
          fills: [fillFromToken(tokens.colors.mutedForeground)],
          textAutoResize: 'HEIGHT',
          x: 0,
          y: tokens.spacing[1],
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
    const parentWidth = parent && 'width' in parent ? (parent as { width: number }).width : 800;
    const sectionResult = createSection(context, {
      parentId: args.parentId,
      direction: 'horizontal',
      spacing: 'normal',
      width: parentWidth,
      height: tokens.sizing.headerHeight,
      align: 'center',
      id: headerId,
    });
    if (!sectionResult.success) return sectionResult;

    if (args.logoLabel != null && args.logoLabel !== '') {
      const logoRectId = generateId('header_logo');
      createRectangle(nodeMap, {
        id: logoRectId,
        name: 'Logo',
        width: tokens.sizing.logoWidth,
        height: tokens.sizing.logoHeight,
        fills: [fillFromToken(tokens.colors.card)],
        cornerRadius: tokens.radius.sm,
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
        width: tokens.sizing.logoWidth,
        height: tokens.sizing.logoHeight,
        fills: [fillFromToken(tokens.colors.card)],
        cornerRadius: tokens.radius.sm,
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
      const headerSpacerId = generateId('header_spacer');
      createFrame(nodeMap, {
        id: headerSpacerId,
        name: 'Spacer',
        width: 0,
        height: tokens.sizing.headerHeight,
        layoutMode: 'NONE',
      }, api);
      appendChild(nodeMap, headerId, headerSpacerId);
      const spacerNode = nodeMap.get(headerSpacerId);
      if (spacerNode && 'layoutGrow' in spacerNode) {
        (spacerNode as SceneNode & { layoutGrow: number }).layoutGrow = 1;
      }

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
  const parentWidth = parent && 'width' in parent ? (parent as { width: number }).width : 600;

  try {
    const sectionResult = createSection(context, {
      parentId: args.parentId,
      direction: 'vertical',
      spacing: 'spacious',
      width: parentWidth,
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
      const heroImageWidth = Math.max(320, parentWidth - 64);
      const heroImageHeight = Math.min(400, Math.round(heroImageWidth * 0.35));
      const imgResult = await addPlaceholderImage(context, {
        parentId: heroId,
        width: heroImageWidth,
        height: heroImageHeight,
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

// --- createFooter ---

export interface CreateFooterArgs {
  parentId: string;
  /** Left-aligned text (e.g. "© 2025 Company") */
  leftText?: string;
  /** Optional link labels in the center (e.g. ["Impressum", "Datenschutz", "AGB"]) */
  linkLabels?: string[];
  /** Right-aligned text (e.g. "All rights reserved") */
  rightText?: string;
  id?: string;
}

export type CreateFooterResult =
  | { success: true; footerId: string }
  | { success: false; error: string };


/**
 * Creates a footer section: horizontal bar with optional left text, optional link labels, optional right text.
 */
export async function createFooter(
  context: ToolContext,
  args: CreateFooterArgs
): Promise<CreateFooterResult> {
  const { nodeMap, api } = context;
  const parent = nodeMap.get(args.parentId);
  if (!parent || !('appendChild' in parent)) {
    return { success: false, error: `createFooter: parent "${args.parentId}" not found or not a container` };
  }

  const footerId = args.id ?? generateId('footer');
  const parentWidth = parent && 'width' in parent ? (parent as { width: number }).width : 800;

  try {
    const sectionResult = createSection(context, {
      parentId: args.parentId,
      direction: 'horizontal',
      spacing: 'normal',
      width: parentWidth,
      height: tokens.sizing.footerHeight,
      align: 'center',
      id: footerId,
    });
    if (!sectionResult.success) return sectionResult;

    if (args.leftText != null && args.leftText !== '') {
      const t = await addText(context, {
        parentId: footerId,
        content: args.leftText,
        variant: 'small',
        id: generateId('footer_left'),
      });
      if (!t.success) return t;
    }

    const linkLabels = args.linkLabels ?? [];
    for (const label of linkLabels) {
      const t = await addText(context, {
        parentId: footerId,
        content: label,
        variant: 'small',
        id: generateId('footer_link'),
      });
      if (!t.success) return t;
    }

    if (args.rightText != null && args.rightText !== '') {
      const hasLeft = (args.leftText != null && args.leftText !== '') || linkLabels.length > 0;
      if (hasLeft) {
        const footerSpacerId = generateId('footer_spacer');
        createFrame(nodeMap, {
          id: footerSpacerId,
          name: 'Spacer',
          width: 0,
          height: tokens.sizing.footerHeight,
          layoutMode: 'NONE',
        }, api);
        appendChild(nodeMap, footerId, footerSpacerId);
        const spacerNode = nodeMap.get(footerSpacerId);
        if (spacerNode && 'layoutGrow' in spacerNode) {
          (spacerNode as SceneNode & { layoutGrow: number }).layoutGrow = 1;
        }
      }
      const t = await addText(context, {
        parentId: footerId,
        content: args.rightText,
        variant: 'small',
        id: generateId('footer_right'),
      });
      if (!t.success) return t;
    }

    return { success: true, footerId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// --- createTabs ---

export interface CreateTabsArgs {
  parentId: string;
  /** Tab labels (e.g. ["Overview", "Details", "Settings"]) */
  tabLabels: string[];
  id?: string;
}

export type CreateTabsResult =
  | { success: true; tabsId: string; tabBarId: string; contentAreaId: string }
  | { success: false; error: string };

const TAB_BAR_HEIGHT = 44;
const TAB_GAP = 8;

/**
 * Creates a tabs container: tab bar (horizontal labels) + content area frame. Add content to contentAreaId.
 */
export async function createTabs(
  context: ToolContext,
  args: CreateTabsArgs
): Promise<CreateTabsResult> {
  const { nodeMap, api } = context;
  const parent = nodeMap.get(args.parentId);
  if (!parent || !('appendChild' in parent)) {
    return { success: false, error: `createTabs: parent "${args.parentId}" not found or not a container` };
  }

  if (!args.tabLabels || args.tabLabels.length === 0) {
    return { success: false, error: 'createTabs: tabLabels array is required and must not be empty' };
  }

  const tabsId = args.id ?? generateId('tabs');
  const tabBarId = `${tabsId}_bar`;
  const contentAreaId = `${tabsId}_content`;
  const parentWidth = parent && 'width' in parent ? (parent as { width: number }).width : 600;

  try {
    createFrame(nodeMap, {
      id: tabsId,
      name: 'Tabs',
      width: parentWidth,
      height: 280,
      layoutMode: 'VERTICAL',
      itemSpacing: 0,
      paddingTop: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      paddingRight: 0,
    }, api);

    createFrame(nodeMap, {
      id: tabBarId,
      name: 'Tab bar',
      width: parentWidth,
      height: TAB_BAR_HEIGHT,
      layoutMode: 'HORIZONTAL',
      itemSpacing: TAB_GAP,
      paddingTop: 8,
      paddingBottom: 8,
      paddingLeft: 12,
      paddingRight: 12,
    }, api);

    createFrame(nodeMap, {
      id: contentAreaId,
      name: 'Tab content',
      width: parentWidth,
      height: 232,
      layoutMode: 'VERTICAL',
      itemSpacing: 12,
      paddingTop: 16,
      paddingBottom: 16,
      paddingLeft: 16,
      paddingRight: 16,
    }, api);

    for (let i = 0; i < args.tabLabels.length; i++) {
      const t = await addText(context, {
        parentId: tabBarId,
        content: args.tabLabels[i],
        variant: 'body',
        id: `${tabBarId}_label_${i}`,
      });
      if (!t.success) return t;
    }

    appendChild(nodeMap, tabsId, tabBarId);
    appendChild(nodeMap, tabsId, contentAreaId);
    appendChild(nodeMap, args.parentId, tabsId);

    return { success: true, tabsId, tabBarId, contentAreaId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// --- createStepper ---

export interface CreateStepperArgs {
  parentId: string;
  /** Step labels (e.g. ["Schritt 1", "Schritt 2", "Schritt 3"]) */
  steps: string[];
  direction?: 'horizontal' | 'vertical';
  id?: string;
}

export type CreateStepperResult =
  | { success: true; stepperId: string }
  | { success: false; error: string };

const STEP_CIRCLE_SIZE = 32;
const STEP_GAP = 16;

/**
 * Creates a stepper: numbered circles (1, 2, 3…) with labels. Horizontal or vertical layout.
 */
export async function createStepper(
  context: ToolContext,
  args: CreateStepperArgs
): Promise<CreateStepperResult> {
  const { nodeMap, api } = context;
  const parent = nodeMap.get(args.parentId);
  if (!parent || !('appendChild' in parent)) {
    return { success: false, error: `createStepper: parent "${args.parentId}" not found or not a container` };
  }

  if (!args.steps || args.steps.length === 0) {
    return { success: false, error: 'createStepper: steps array is required and must not be empty' };
  }

  const stepperId = args.id ?? generateId('stepper');
  const direction = args.direction ?? 'horizontal';

  try {
    createFrame(nodeMap, {
      id: stepperId,
      name: 'Stepper',
      width: direction === 'horizontal' ? args.steps.length * (STEP_CIRCLE_SIZE + 80) : 200,
      height: direction === 'horizontal' ? 56 : args.steps.length * 56,
      layoutMode: direction === 'horizontal' ? 'HORIZONTAL' : 'VERTICAL',
      itemSpacing: STEP_GAP,
      paddingTop: 8,
      paddingBottom: 8,
      paddingLeft: 8,
      paddingRight: 8,
      counterAxisAlignItems: 'CENTER',
    }, api);

    for (let i = 0; i < args.steps.length; i++) {
      const stepFrameId = `${stepperId}_step_${i}`;
      const circleId = `${stepperId}_circle_${i}`;

      createFrame(nodeMap, {
        id: stepFrameId,
        name: `Step ${i + 1}`,
        width: direction === 'horizontal' ? 120 : 184,
        height: 40,
        layoutMode: 'HORIZONTAL',
        itemSpacing: 8,
        paddingTop: 0,
        paddingBottom: 0,
        paddingLeft: 0,
        paddingRight: 0,
        counterAxisAlignItems: 'CENTER',
      }, api);

      createEllipse(nodeMap, {
        id: circleId,
        name: `Step ${i + 1} circle`,
        width: STEP_CIRCLE_SIZE,
        height: STEP_CIRCLE_SIZE,
        strokes: [{ type: 'SOLID', color: { r: 0.3, g: 0.3, b: 0.3 }, opacity: 1 }],
        strokeWeight: 2,
      }, api);

      appendChild(nodeMap, stepFrameId, circleId);

      const numResult = await addText(context, {
        parentId: stepFrameId,
        content: String(i + 1),
        variant: 'body',
        id: `${stepperId}_num_${i}`,
      });
      if (!numResult.success) return numResult;

      const labelResult = await addText(context, {
        parentId: stepFrameId,
        content: args.steps[i],
        variant: 'small',
        id: `${stepperId}_label_${i}`,
      });
      if (!labelResult.success) return labelResult;

      appendChild(nodeMap, stepperId, stepFrameId);
    }

    appendChild(nodeMap, args.parentId, stepperId);
    return { success: true, stepperId };
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

/** Text variant -> font (derived from design tokens). */
const TEXT_VARIANT_FONT: Record<string, { size: number; family: string; style: string }> = {
  h1: { size: tokens.typography.h1.fontSize, family: tokens.typography.fontFamily, style: tokens.typography.h1.fontStyle },
  h2: { size: tokens.typography.h2.fontSize, family: tokens.typography.fontFamily, style: tokens.typography.h2.fontStyle },
  h3: { size: tokens.typography.h3.fontSize, family: tokens.typography.fontFamily, style: tokens.typography.h3.fontStyle },
  body: { size: tokens.typography.body.fontSize, family: tokens.typography.fontFamily, style: tokens.typography.body.fontStyle },
  small: { size: tokens.typography.small.fontSize, family: tokens.typography.fontFamily, style: tokens.typography.small.fontStyle },
  caption: { size: tokens.typography.caption.fontSize, family: tokens.typography.fontFamily, style: tokens.typography.caption.fontStyle },
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
    await createText(nodeMap, {
      id: textId,
      name: `Text: ${(args.content || '').slice(0, 30)}`,
      characters: args.content || '',
      fontSize: font.size,
      fontFamily: font.family,
      fontStyle: font.style,
      fills: [fillFromToken(tokens.colors.foreground)],
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

  const parentWidth = parent && 'width' in parent ? (parent as { width: number }).width : 0;
  const effectiveWidth = args.width ?? (parentWidth >= 400 ? parentWidth - 64 : 320);
  const effectiveHeight = args.height ?? (parentWidth >= 400 ? Math.min(400, Math.round(effectiveWidth * 0.3)) : 180);
  const width = effectiveWidth;
  const height = effectiveHeight;
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
      fills: [fillFromToken(tokens.colors.muted)],
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
