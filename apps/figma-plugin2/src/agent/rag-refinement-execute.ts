/**
 * Execute RAG refinement tools on existing Figma nodes.
 * Used by rag-refinement-agent after scanning/composing.
 */

import type { ScannedNode } from './rag-refinement-tools';

function parsePadding(s: string): [number, number, number, number] {
  const parts = s.split(',').map((p) => parseInt(p.trim(), 10));
  if (parts.length === 1) return [parts[0], parts[0], parts[0], parts[0]];
  if (parts.length === 2) return [parts[0], parts[1], parts[0], parts[1]];
  if (parts.length === 4) return [parts[0], parts[1], parts[2], parts[3]];
  return [0, 0, 0, 0];
}

/** Ensure frame has auto-layout so padding, itemSpacing, align take effect. */
function ensureAutoLayout(frame: FrameNode): void {
  if (frame.layoutMode === 'NONE') {
    frame.layoutMode = 'VERTICAL';
    frame.primaryAxisSizingMode = 'AUTO';
    frame.counterAxisSizingMode = 'AUTO';
  }
}

function scanNode(node: FrameNode | SceneNode): ScannedNode | null {
  const bounds = 'absoluteBoundingBox' in node && node.absoluteBoundingBox
    ? {
        x: node.absoluteBoundingBox.x,
        y: node.absoluteBoundingBox.y,
        width: node.absoluteBoundingBox.width,
        height: node.absoluteBoundingBox.height,
      }
    : { x: 0, y: 0, width: 0, height: 0 };

  const base: ScannedNode = {
    id: node.id,
    name: node.name,
    type: node.type,
    bounds,
  };

  if (node.type === 'FRAME') {
    const frame = node as FrameNode;
    base.layoutMode = frame.layoutMode;
    base.itemSpacing = frame.itemSpacing;
    base.paddingTop = frame.paddingTop;
    base.paddingRight = frame.paddingRight;
    base.paddingBottom = frame.paddingBottom;
    base.paddingLeft = frame.paddingLeft;
    base.counterAxisAlignItems = frame.counterAxisAlignItems;
    base.primaryAxisAlignItems = frame.primaryAxisAlignItems;
    if ('children' in frame && frame.children.length > 0) {
      base.children = frame.children
        .map((c) => scanNode(c as FrameNode))
        .filter((n): n is ScannedNode => n != null);
    }
  }

  return base;
}

export function executeScanComposedStructure(rootId: string): { success: boolean; structure?: ScannedNode; error?: string } {
  const node = figma.getNodeById(rootId);
  if (!node) return { success: false, error: `Node ${rootId} not found` };
  if (node.type !== 'FRAME') return { success: false, error: `Node ${rootId} is not a frame` };
  const structure = scanNode(node as FrameNode);
  return { success: true, structure: structure ?? undefined };
}

export function executeSetPadding(nodeId: string, padding: string): { success: boolean; result?: { applied: boolean }; error?: string } {
  const node = figma.getNodeById(nodeId);
  if (!node) return { success: false, error: `Node ${nodeId} not found` };
  if (node.type !== 'FRAME') return { success: false, error: `Node ${nodeId} is not a frame` };
  const frame = node as FrameNode;
  ensureAutoLayout(frame);
  const [pt, pr, pb, pl] = parsePadding(padding);
  frame.paddingTop = pt;
  frame.paddingRight = pr;
  frame.paddingBottom = pb;
  frame.paddingLeft = pl;
  return { success: true, result: { applied: true } };
}

export function executeSetGap(nodeId: string, gap: number): { success: boolean; result?: { applied: boolean }; error?: string } {
  const node = figma.getNodeById(nodeId);
  if (!node) return { success: false, error: `Node ${nodeId} not found` };
  if (node.type !== 'FRAME') return { success: false, error: `Node ${nodeId} is not a frame` };
  const frame = node as FrameNode;
  ensureAutoLayout(frame);
  frame.itemSpacing = gap;
  return { success: true, result: { applied: true } };
}

export function executeSetAlign(nodeId: string, align: string): { success: boolean; result?: { applied: boolean }; error?: string } {
  const node = figma.getNodeById(nodeId);
  if (!node) return { success: false, error: `Node ${nodeId} not found` };
  if (node.type !== 'FRAME') return { success: false, error: `Node ${nodeId} is not a frame` };
  const frame = node as FrameNode;
  ensureAutoLayout(frame);
  if (align === 'start') frame.counterAxisAlignItems = 'MIN';
  else if (align === 'center') frame.counterAxisAlignItems = 'CENTER';
  else if (align === 'end') frame.counterAxisAlignItems = 'MAX';
  return { success: true, result: { applied: true } };
}

export function executeSetJustify(nodeId: string, justify: string): { success: boolean; result?: { applied: boolean }; error?: string } {
  const node = figma.getNodeById(nodeId);
  if (!node) return { success: false, error: `Node ${nodeId} not found` };
  if (node.type !== 'FRAME') return { success: false, error: `Node ${nodeId} is not a frame` };
  const frame = node as FrameNode;
  ensureAutoLayout(frame);
  if (justify === 'start') frame.primaryAxisAlignItems = 'MIN';
  else if (justify === 'center') frame.primaryAxisAlignItems = 'CENTER';
  else if (justify === 'end') frame.primaryAxisAlignItems = 'MAX';
  else if (justify === 'space-between') frame.primaryAxisAlignItems = 'SPACE_BETWEEN';
  return { success: true, result: { applied: true } };
}

export function executeSetMaxWidth(nodeId: string, width: number): { success: boolean; result?: { applied: boolean }; error?: string } {
  const node = figma.getNodeById(nodeId);
  if (!node) return { success: false, error: `Node ${nodeId} not found` };
  if (node.type !== 'FRAME') return { success: false, error: `Node ${nodeId} is not a frame` };
  const frame = node as FrameNode;
  frame.resize(width, Math.max(1, frame.height));
  return { success: true, result: { applied: true } };
}

export function executeSetSectionMaxWidth(sectionId: string, width: number): { success: boolean; result?: { applied: boolean }; error?: string } {
  return executeSetMaxWidth(sectionId, width);
}

export function executeDistributeSpacing(parentId: string): { success: boolean; result?: { applied: boolean }; error?: string } {
  return executeSetJustify(parentId, 'space-between');
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace(/^#/, '');
  return {
    r: parseInt(clean.slice(0, 2), 16) / 255,
    g: parseInt(clean.slice(2, 4), 16) / 255,
    b: parseInt(clean.slice(4, 6), 16) / 255,
  };
}

export function executeSetFill(nodeId: string, color: string): { success: boolean; result?: { applied: boolean }; error?: string } {
  const node = figma.getNodeById(nodeId);
  if (!node) return { success: false, error: `Node ${nodeId} not found` };
  if (node.type !== 'FRAME') return { success: false, error: `Node ${nodeId} is not a frame` };
  try {
    const rgb = hexToRgb(color);
    (node as FrameNode).fills = [{ type: 'SOLID', color: rgb, opacity: 1 }];
    return { success: true, result: { applied: true } };
  } catch {
    return { success: false, error: `Invalid color: ${color}` };
  }
}

export function executeSetCornerRadius(nodeId: string, radius: number): { success: boolean; result?: { applied: boolean }; error?: string } {
  const node = figma.getNodeById(nodeId);
  if (!node) return { success: false, error: `Node ${nodeId} not found` };
  if (node.type !== 'FRAME') return { success: false, error: `Node ${nodeId} is not a frame` };
  (node as FrameNode).cornerRadius = Math.max(0, radius);
  return { success: true, result: { applied: true } };
}

export function executeReorderChildren(parentId: string, childIds: string[]): { success: boolean; result?: { applied: boolean }; error?: string } {
  const parent = figma.getNodeById(parentId);
  if (!parent) return { success: false, error: `Node ${parentId} not found` };
  if (parent.type !== 'FRAME') return { success: false, error: `Node ${parentId} is not a frame` };
  const frame = parent as FrameNode;
  if (!('children' in frame) || !Array.isArray(frame.children)) {
    return { success: false, error: 'Frame has no children' };
  }
  const ids = childIds.filter(Boolean);
  if (ids.length === 0) return { success: true, result: { applied: true } };
  for (let i = ids.length - 1; i >= 0; i--) {
    const child = figma.getNodeById(ids[i]);
    if (child && 'appendChild' in frame) {
      frame.appendChild(child as SceneNode);
    }
  }
  return { success: true, result: { applied: true } };
}

export type RagRefinementToolName =
  | 'scanComposedStructure'
  | 'setPadding'
  | 'setGap'
  | 'setAlign'
  | 'setJustify'
  | 'setMaxWidth'
  | 'setSectionMaxWidth'
  | 'distributeSpacing'
  | 'setFill'
  | 'setCornerRadius'
  | 'reorderChildren';

export function executeRagRefinementTool(
  toolName: RagRefinementToolName,
  args: Record<string, unknown>
): { success: boolean; result?: unknown; error?: string } {
  switch (toolName) {
    case 'scanComposedStructure': {
      const rootId = args.rootId as string;
      const out = executeScanComposedStructure(rootId);
      return out.success
        ? { success: true, result: out.structure }
        : { success: false, error: out.error };
    }
    case 'setPadding': {
      const out = executeSetPadding(args.nodeId as string, args.padding as string);
      return { success: out.success, result: out.result, error: out.error };
    }
    case 'setGap': {
      const out = executeSetGap(args.nodeId as string, args.gap as number);
      return { success: out.success, result: out.result, error: out.error };
    }
    case 'setAlign': {
      const out = executeSetAlign(args.nodeId as string, args.align as string);
      return { success: out.success, result: out.result, error: out.error };
    }
    case 'setJustify': {
      const out = executeSetJustify(args.nodeId as string, args.justify as string);
      return { success: out.success, result: out.result, error: out.error };
    }
    case 'setMaxWidth': {
      const out = executeSetMaxWidth(args.nodeId as string, args.width as number);
      return { success: out.success, result: out.result, error: out.error };
    }
    case 'setSectionMaxWidth': {
      const out = executeSetSectionMaxWidth(args.sectionId as string, args.width as number);
      return { success: out.success, result: out.result, error: out.error };
    }
    case 'distributeSpacing': {
      const out = executeDistributeSpacing(args.parentId as string);
      return { success: out.success, result: out.result, error: out.error };
    }
    case 'setFill': {
      const out = executeSetFill(args.nodeId as string, args.color as string);
      return { success: out.success, result: out.result, error: out.error };
    }
    case 'setCornerRadius': {
      const out = executeSetCornerRadius(args.nodeId as string, args.radius as number);
      return { success: out.success, result: out.result, error: out.error };
    }
    case 'reorderChildren': {
      const out = executeReorderChildren(
        args.parentId as string,
        Array.isArray(args.childIds) ? (args.childIds as string[]) : []
      );
      return { success: out.success, result: out.result, error: out.error };
    }
    default:
      return { success: false, error: `Unknown tool: ${toolName}` };
  }
}
