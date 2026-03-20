/**
 * CREATION attaches `figmaAutoLayout`, `figmaFlexWrapRows`, `figmaFlexGap`, `figmaGridMeta`,
 * `figmaGridRows`, `figmaNormalizeChildXY` on FRAME/GROUP JSON; `textLayoutHint` on TEXT.
 * Peel before `assign()`, then apply explicitly.
 */

import type { PlainLayerNode, WithRef } from "../types";

/** Layer JSON after `processLayer` (has `ref` + nested `children`). */
type LayerJsonWithRefs = WithRef<PlainLayerNode> & {
  children?: LayerJsonWithRefs[];
};

export type FigmaAutoLayoutPayload = {
  layoutMode: "HORIZONTAL" | "VERTICAL";
  primaryAxisAlignItems: "MIN" | "MAX" | "CENTER" | "SPACE_BETWEEN";
  counterAxisAlignItems: "MIN" | "MAX" | "CENTER" | "BASELINE";
  primaryAxisSizingMode?: "FIXED" | "AUTO";
  counterAxisSizingMode?: "FIXED" | "AUTO";
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  itemSpacing: number;
  counterAxisSpacing?: number;
  layoutWrap?: "WRAP" | "NO_WRAP";
  counterAxisAlignContent?: "AUTO" | "SPACE_BETWEEN";
  itemReverseZIndex?: boolean;
};

export type TextLayoutHintPayload = {
  textAutoResize: "NONE" | "WIDTH_AND_HEIGHT" | "HEIGHT" | "TRUNCATE";
  applyEllipsis?: boolean;
  maxLines?: number;
};

export type HtmlFigmaFrameLayoutMeta = {
  figmaAutoLayout?: FigmaAutoLayoutPayload;
  figmaFlexWrapRows?: number[][];
  figmaFlexGap?: { row: number; column: number };
  figmaGridMeta?: { columnCount: number; columnGap: number; rowGap: number };
  figmaGridRows?: number[][];
};

const META_KEYS = [
  "figmaAutoLayout",
  "figmaFlexWrapRows",
  "figmaFlexGap",
  "figmaGridMeta",
  "figmaGridRows",
] as const;

export const HTML_FIGMA_LAYOUT_META_KEY = "__htmlFigmaLayoutMeta" as const;
export const HTML_FIGMA_PENDING_NORMALIZE_KEY = "__htmlFigmaPendingNormalize" as const;
/** Child must not receive `layoutPositioning` in `assign()` until parent has Auto Layout (see `applyAllPendingLayoutPositioning`). */
export const HTML_FIGMA_PENDING_LAYOUT_POSITIONING_KEY =
  "__htmlFigmaPendingLayoutPositioning" as const;

/**
 * `layoutPositioning: ABSOLUTE` throws if parent still has `layoutMode === NONE` (common: plain card frame
 * or parent with `deferPrimaryLayout`). Strip before assign; apply in a final tree pass.
 */
export function peelDeferredLayoutPositioning(layer: Record<string, unknown>): void {
  const lp = layer.layoutPositioning;
  if (lp !== "ABSOLUTE") return;
  delete layer.layoutPositioning;
  layer[HTML_FIGMA_PENDING_LAYOUT_POSITIONING_KEY] = "ABSOLUTE";
}

export function peelFrameLayoutMeta(layer: Record<string, unknown>): HtmlFigmaFrameLayoutMeta | undefined {
  if (layer.figmaNormalizeChildXY === true) {
    layer[HTML_FIGMA_PENDING_NORMALIZE_KEY] = true;
    delete layer.figmaNormalizeChildXY;
  }

  const meta: HtmlFigmaFrameLayoutMeta = {};
  let any = false;
  for (const k of META_KEYS) {
    const v = layer[k];
    if (v !== undefined) {
      any = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (meta as any)[k] = v;
      delete layer[k];
    }
  }
  if (!any) return undefined;
  (layer as Record<string, unknown>)[HTML_FIGMA_LAYOUT_META_KEY] = meta;
  return meta;
}

export function getFrameLayoutMeta(layer: Record<string, unknown>): HtmlFigmaFrameLayoutMeta | undefined {
  return layer[HTML_FIGMA_LAYOUT_META_KEY] as HtmlFigmaFrameLayoutMeta | undefined;
}

export function clearFrameLayoutMeta(layer: Record<string, unknown>): void {
  delete layer[HTML_FIGMA_LAYOUT_META_KEY];
}

export function applyAutoLayoutToFrame(
  frame: FrameNode,
  payload: FigmaAutoLayoutPayload,
  options?: { deferPrimaryLayout?: boolean }
): void {
  frame.paddingTop = Math.max(0, payload.paddingTop ?? 0);
  frame.paddingRight = Math.max(0, payload.paddingRight ?? 0);
  frame.paddingBottom = Math.max(0, payload.paddingBottom ?? 0);
  frame.paddingLeft = Math.max(0, payload.paddingLeft ?? 0);

  if (options?.deferPrimaryLayout) return;

  frame.layoutMode = payload.layoutMode;
  frame.primaryAxisAlignItems = payload.primaryAxisAlignItems;
  frame.counterAxisAlignItems = payload.counterAxisAlignItems;
  if (payload.primaryAxisSizingMode) {
    frame.primaryAxisSizingMode = payload.primaryAxisSizingMode;
  }
  if (payload.counterAxisSizingMode) {
    frame.counterAxisSizingMode = payload.counterAxisSizingMode;
  }
  frame.itemSpacing = Math.max(0, payload.itemSpacing ?? 0);
  if (payload.layoutWrap != null) {
    frame.layoutWrap = payload.layoutWrap;
  }

  if (frame.layoutWrap === "WRAP" && payload.counterAxisSpacing != null) {
    frame.counterAxisSpacing = Math.max(0, payload.counterAxisSpacing);
  } else {
    frame.counterAxisSpacing = null;
  }

  if (frame.layoutWrap === "WRAP" && payload.counterAxisAlignContent != null) {
    frame.counterAxisAlignContent = payload.counterAxisAlignContent;
  }

  if (payload.itemReverseZIndex != null) {
    frame.itemReverseZIndex = payload.itemReverseZIndex;
  }
}

/**
 * CSS grid: reparent children into row frames (native row AL + vertical parent), using `figmaGridMeta` gaps.
 */
export function finalizeGridRows(layer: PlainLayerNode): void {
  const layerTree = layer as LayerJsonWithRefs;
  const bag = getFrameLayoutMeta(layer as Record<string, unknown>);
  if (!bag) return;
  const rows = bag.figmaGridRows;
  if (!Array.isArray(rows) || rows.length <= 1) return;

  const parent = layerTree.ref as FrameNode | undefined;
  if (!parent || parent.type !== "FRAME") {
    return;
  }

  const payload = bag.figmaAutoLayout;
  const meta = bag.figmaGridMeta;
  if (!payload || !meta) return;

  const kids = layerTree.children || [];
  const flatIdx = ([] as number[]).concat(...rows);
  if (!flatIdx.length) return;
  const maxIdx = Math.max(...flatIdx);
  if (maxIdx < 0 || maxIdx >= kids.length) return;

  const colGap = meta.columnGap > 0 ? meta.columnGap : payload.itemSpacing ?? 0;
  const rowGap = meta.rowGap > 0 ? meta.rowGap : payload.itemSpacing ?? 0;

  applyAutoLayoutToFrame(parent, payload, { deferPrimaryLayout: true });

  for (const row of rows) {
    const rowFrame = figma.createFrame();
    rowFrame.name = "grid-row";
    rowFrame.layoutMode = "HORIZONTAL";
    rowFrame.itemSpacing = Math.max(0, colGap);
    rowFrame.primaryAxisAlignItems = "MIN";
    rowFrame.counterAxisAlignItems = payload.counterAxisAlignItems;
    rowFrame.fills = [];

    for (const idx of row) {
      const ch = kids[idx] as LayerJsonWithRefs | undefined;
      const ref = ch?.ref as SceneNode | undefined;
      if (ref && ref.parent === parent) {
        rowFrame.appendChild(ref);
      }
    }
    parent.appendChild(rowFrame);
  }

  parent.layoutMode = "VERTICAL";
  parent.itemSpacing = Math.max(0, rowGap);
  parent.primaryAxisAlignItems = "MIN";
  parent.counterAxisAlignItems = payload.counterAxisAlignItems;
  parent.layoutWrap = "NO_WRAP";
  parent.counterAxisSpacing = null;

  clearFrameLayoutMeta(layer as Record<string, unknown>);
}

export function finalizeFlexWrapRows(layer: PlainLayerNode): void {
  const layerTree = layer as LayerJsonWithRefs;
  const bag = getFrameLayoutMeta(layer as Record<string, unknown>);
  if (!bag) return;
  const rows = bag.figmaFlexWrapRows;
  if (!Array.isArray(rows) || rows.length <= 1) return;

  const parent = layerTree.ref as FrameNode | undefined;
  if (!parent || parent.type !== "FRAME") return;

  const payload = bag.figmaAutoLayout;
  if (!payload) return;

  const kids = layerTree.children || [];
  const flatIdx = ([] as number[]).concat(...rows);
  if (!flatIdx.length) return;
  const maxIdx = Math.max(...flatIdx);
  if (maxIdx < 0 || maxIdx >= kids.length) return;

  const gap = bag.figmaFlexGap;
  const colGap = gap?.column != null && gap.column > 0 ? gap.column : payload.itemSpacing ?? 0;
  const rowGap = gap?.row != null && gap.row > 0 ? gap.row : payload.itemSpacing ?? 0;

  applyAutoLayoutToFrame(parent, payload, { deferPrimaryLayout: true });

  const primaryWasHorizontal = payload.layoutMode === "HORIZONTAL";
  const rowLayoutMode: "HORIZONTAL" | "VERTICAL" = primaryWasHorizontal ? "HORIZONTAL" : "VERTICAL";

  for (const row of rows) {
    const rowFrame = figma.createFrame();
    rowFrame.name = "flex-row";
    rowFrame.layoutMode = rowLayoutMode;
    rowFrame.itemSpacing = Math.max(0, colGap);
    rowFrame.primaryAxisAlignItems = payload.primaryAxisAlignItems;
    rowFrame.counterAxisAlignItems = payload.counterAxisAlignItems;
    rowFrame.fills = [];

    for (const idx of row) {
      const ch = kids[idx] as LayerJsonWithRefs | undefined;
      const ref = ch?.ref as SceneNode | undefined;
      if (ref && ref.parent === parent) {
        rowFrame.appendChild(ref);
      }
    }
    parent.appendChild(rowFrame);
  }

  parent.layoutMode = "VERTICAL";
  parent.itemSpacing = Math.max(0, rowGap);
  parent.primaryAxisAlignItems = "MIN";
  parent.counterAxisAlignItems = payload.counterAxisAlignItems;
  parent.layoutWrap = "NO_WRAP";
  parent.counterAxisSpacing = null;
  if (payload.itemReverseZIndex != null) {
    parent.itemReverseZIndex = payload.itemReverseZIndex;
  }

  clearFrameLayoutMeta(layer as Record<string, unknown>);
}

/** After auto-layout, zero child offsets so Figma AL does not mix absolute leftovers. */
export function finalizeNormalizeAutoLayoutChildren(layer: PlainLayerNode): void {
  const layerRec = layer as Record<string, unknown>;
  if (!layerRec[HTML_FIGMA_PENDING_NORMALIZE_KEY]) return;
  delete layerRec[HTML_FIGMA_PENDING_NORMALIZE_KEY];

  const layerTree = layer as LayerJsonWithRefs;
  const parent = layerTree.ref as FrameNode | undefined;
  if (!parent || parent.type !== "FRAME" || parent.layoutMode === "NONE") return;

  for (const child of parent.children) {
    try {
      if ("layoutPositioning" in child && child.layoutPositioning === "ABSOLUTE") {
        continue;
      }
      child.x = 0;
      child.y = 0;
    } catch (_) {
      /* ignore */
    }
  }
}

/**
 * After grid/flex finalizers, parents have real Auto Layout. Apply ABSOLUTE children then.
 */
export function applyAllPendingLayoutPositioning(root: PlainLayerNode): void {
  const walk = (layer: PlainLayerNode): void => {
    const ch = (layer as { children?: PlainLayerNode[] }).children;
    if (Array.isArray(ch)) {
      for (const c of ch) {
        walk(c as PlainLayerNode);
      }
    }
    const rec = layer as Record<string, unknown>;
    if (rec[HTML_FIGMA_PENDING_LAYOUT_POSITIONING_KEY] !== "ABSOLUTE") {
      return;
    }
    delete rec[HTML_FIGMA_PENDING_LAYOUT_POSITIONING_KEY];
    const tree = layer as LayerJsonWithRefs;
    const node = tree.ref;
    if (!node || !("layoutPositioning" in node)) {
      return;
    }
    const parent = node.parent;
    if (!parent || parent.type !== "FRAME" || parent.layoutMode === "NONE") {
      return;
    }
    try {
      (node as SceneNode & { layoutPositioning?: "AUTO" | "ABSOLUTE" }).layoutPositioning = "ABSOLUTE";
    } catch (_) {
      /* ignore */
    }
  };
  walk(root);
}

const ROTATION_EPS = 0.02;

/**
 * True if this JSON subtree carries a non-zero `rotation` (e.g. from CREATION DOM transform merge).
 * Used to skip Auto Layout on parents — AL + rotated children often misplaces geometry in Figma.
 */
export function layerJsonSubtreeHasRotation(layer: Record<string, unknown>, depth = 0): boolean {
  if (depth > 200) return false;
  const r = layer.rotation;
  if (typeof r === "number" && Math.abs(r) > ROTATION_EPS) return true;
  const ch = layer.children;
  if (!Array.isArray(ch)) return false;
  for (const c of ch) {
    if (
      c &&
      typeof c === "object" &&
      layerJsonSubtreeHasRotation(c as Record<string, unknown>, depth + 1)
    ) {
      return true;
    }
  }
  return false;
}
