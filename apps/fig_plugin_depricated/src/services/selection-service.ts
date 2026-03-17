import type { SelectionMetadata } from '../types';
import { getFigmaFileUrl } from '../api/figma-api';

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

  // Map Figma node types to our types
  let selectionType: 'ARTBOARD' | 'GROUP' | 'FRAME' = 'FRAME';
  if (node.type === 'FRAME') {
    // Check if it's an artboard (frames with isArtboard = true)
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
    figmaUrl,
  };
}

export function getSelectionMetadata(): SelectionMetadata | null {
  const selection = getSelectedNodes();
  
  if (!validateSelection(selection)) {
    return null;
  }

  return extractMetadata(selection[0]);
}

