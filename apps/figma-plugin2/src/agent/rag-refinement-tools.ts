/**
 * RAG Refinement Tools – operate on an already-rendered RAG composition.
 * scanComposedStructure reads the layout; setPadding, setGap, etc. adjust it.
 */

export interface ScannedNode {
  id: string;
  name: string;
  type: string;
  bounds: { x: number; y: number; width: number; height: number };
  layoutMode?: 'NONE' | 'HORIZONTAL' | 'VERTICAL' | 'GRID';
  itemSpacing?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  counterAxisAlignItems?: string;
  primaryAxisAlignItems?: string;
  children?: ScannedNode[];
}

export interface OpenAIToolSchema {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, { type: string; description?: string; enum?: string[]; items?: { type: string } }>;
      required?: string[];
    };
  };
}

export const RAG_REFINEMENT_TOOLS: OpenAIToolSchema[] = [
  {
    type: 'function',
    function: {
      name: 'scanComposedStructure',
      description: 'Scan the rendered RAG composition and return its structure (nodes, bounds, layout, padding, gap). Call this first to understand the current layout before making changes.',
      parameters: {
        type: 'object',
        properties: {
          rootId: { type: 'string', description: 'Figma node ID of the root composed frame' },
        },
        required: ['rootId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'setPadding',
      description: 'Set padding on a frame/section (top, right, bottom, left in px). Use 8px grid: 8, 16, 24, 32, 48, 64, 96.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Figma node ID' },
          padding: {
            type: 'string',
            description: 'Padding as number (all sides), "v,h" or "t,r,b,l". E.g. "64", "80,24", "96,80,96,80"',
          },
        },
        required: ['nodeId', 'padding'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'setGap',
      description: 'Set item spacing (gap) between children of a frame. Use 8px grid: 16, 24, 32, 48, 64.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Figma node ID' },
          gap: { type: 'number', description: 'Space in px between children' },
        },
        required: ['nodeId', 'gap'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'setAlign',
      description: 'Set cross-axis alignment (counterAxisAlignItems) of a frame.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Figma node ID' },
          align: {
            type: 'string',
            enum: ['start', 'center', 'end'],
            description: 'start=left/top, center, end=right/bottom',
          },
        },
        required: ['nodeId', 'align'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'setJustify',
      description: 'Set main-axis alignment (primaryAxisAlignItems) of a frame.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Figma node ID' },
          justify: {
            type: 'string',
            enum: ['start', 'center', 'end', 'space-between'],
            description: 'start, center, end, or space-between',
          },
        },
        required: ['nodeId', 'justify'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'setMaxWidth',
      description: 'Resize a frame to a maximum width. Use for centering content: e.g. 1200 for desktop, 720 for content.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Figma node ID' },
          width: { type: 'number', description: 'Width in px' },
        },
        required: ['nodeId', 'width'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'setSectionMaxWidth',
      description: 'Set max width on a section frame. Same as setMaxWidth but semantically for sections. Use 1200-1440 for desktop, 720 for content sections.',
      parameters: {
        type: 'object',
        properties: {
          sectionId: { type: 'string', description: 'Figma node ID of the section frame' },
          width: { type: 'number', description: 'Max width in px (8px grid: 720, 1080, 1200, 1280, 1440)' },
        },
        required: ['sectionId', 'width'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'distributeSpacing',
      description: 'Distribute children evenly with space-between. Good for footers, headers, or rows with multiple elements.',
      parameters: {
        type: 'object',
        properties: {
          parentId: { type: 'string', description: 'Figma node ID of the parent frame' },
        },
        required: ['parentId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'setFill',
      description: 'Set background fill color on a frame. Use hex color e.g. #ffffff, #f8f9fa.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Figma node ID' },
          color: { type: 'string', description: 'Hex color e.g. #ffffff' },
        },
        required: ['nodeId', 'color'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'setCornerRadius',
      description: 'Set corner radius on a frame. Use 8px grid: 0, 8, 16, 24.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Figma node ID' },
          radius: { type: 'number', description: 'Corner radius in px' },
        },
        required: ['nodeId', 'radius'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'reorderChildren',
      description: 'Reorder children of a frame. Pass child node IDs in the desired order.',
      parameters: {
        type: 'object',
        properties: {
          parentId: { type: 'string', description: 'Figma node ID of the parent frame' },
          childIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Child node IDs in desired order',
          },
        },
        required: ['parentId', 'childIds'],
      },
    },
  },
];
