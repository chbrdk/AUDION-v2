import type { SelectionMetadata } from '../types';
import { getFigmaFileUrl, getFigmaFileId } from '../api/figma-api';

export function getSelectedNodes(): readonly SceneNode[] {
  return figma.currentPage.selection;
}

export function validateSelection(selection: readonly SceneNode[]): boolean {
  if (selection.length === 0) {
    return false;
  }

  // Only allow single selection for now
  if (selection.length > 1) {
    return false;
  }

  const node = selection[0];
  const validTypes: NodeType[] = ['FRAME', 'GROUP'];

  return validTypes.includes(node.type);
}

export function extractMetadata(node: SceneNode): SelectionMetadata {
  const bounds = {
    x: node.x,
    y: node.y,
    width: 'width' in node ? node.width : 0,
    height: 'height' in node ? node.height : 0,
  };

  // Extract layer information (children)
  const layers: Array<{ id: string; name: string; type: string }> = [];
  
  if ('children' in node) {
    const extractLayers = (parent: SceneNode, depth: number = 0): void => {
      // Limit depth to avoid too much data
      if (depth > 3) return;
      
      if ('children' in parent) {
        for (const child of parent.children) {
          layers.push({
            id: child.id,
            name: child.name,
            type: child.type,
          });
          extractLayers(child, depth + 1);
        }
      }
    };
    
    extractLayers(node, 0);
  }

  const figmaUrl = getFigmaFileUrl(node.id);
  const fileId = getFigmaFileId();

  // Extract Visual Styles for Iterative Context
  const visualStyles: any = {};
  if ('fills' in node && Array.isArray(node.fills)) {
    const solid = node.fills.find(f => f.type === 'SOLID') as SolidPaint;
    if (solid) {
      const toHex = (c: number) => Math.round(c * 255).toString(16).padStart(2, '0');
      visualStyles.fill = `#${toHex(solid.color.r)}${toHex(solid.color.g)}${toHex(solid.color.b)}`.toUpperCase();
      visualStyles.opacity = solid.opacity;
    }
  }
  if ('cornerRadius' in node && typeof node.cornerRadius === 'number') visualStyles.cornerRadius = node.cornerRadius;
  if ('paddingTop' in node) visualStyles.padding = { top: node.paddingTop, right: node.paddingRight, bottom: node.paddingBottom, left: node.paddingLeft };
  if ('itemSpacing' in node && node.itemSpacing > 0) visualStyles.gap = node.itemSpacing;
  if ('layoutMode' in node) visualStyles.layout = node.layoutMode;

  // Map Figma node types to our types
  let selectionType: 'ARTBOARD' | 'GROUP' | 'FRAME' = 'FRAME';
  if (node.type === 'FRAME') {
    if ('isArtboard' in node && node.isArtboard) {
      selectionType = 'ARTBOARD';
    } else {
      selectionType = 'FRAME';
    }
  } else if (node.type === 'GROUP') {
    selectionType = 'GROUP';
  }

  return {
    nodeId: node.id,
    name: node.name,
    type: selectionType,
    bounds,
    layers,
    visualStyles,
    figmaUrl,
    fileId,
  };
}

export function getSelectionMetadata(): SelectionMetadata | null {
  const selection = getSelectedNodes();
  
  if (!validateSelection(selection)) {
    return null;
  }

  return extractMetadata(selection[0]);
}

