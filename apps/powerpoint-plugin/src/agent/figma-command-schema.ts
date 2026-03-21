/**
 * Figma Command Schema – Whitelist of operations for the Figma Executor agent.
 * Only these commands are executed by the command interpreter (no generated code).
 * Reference: https://developers.figma.com/docs/plugins/api/figma/
 */

export type RGB = { r: number; g: number; b: number };

export type SolidFill = {
  type: 'SOLID';
  color: RGB;
  opacity?: number;
};

// --- Command types (op) ---

export interface LoadFontCommand {
  op: 'loadFont';
  family: string;
  style: string;
}

export interface CreateFrameCommand {
  op: 'createFrame';
  id: string;
  name?: string;
  width: number;
  height: number;
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
  clipsContent?: boolean;
  opacity?: number;
  x?: number;
  y?: number;
}

export interface CreateRectangleCommand {
  op: 'createRectangle';
  id: string;
  name?: string;
  width: number;
  height: number;
  fills?: SolidFill[];
  strokes?: SolidFill[];
  strokeWeight?: number;
  cornerRadius?: number;
  opacity?: number;
  x?: number;
  y?: number;
}

export interface CreateEllipseCommand {
  op: 'createEllipse';
  id: string;
  name?: string;
  width: number;
  height: number;
  fills?: SolidFill[];
  strokes?: SolidFill[];
  strokeWeight?: number;
  opacity?: number;
  x?: number;
  y?: number;
}

export interface CreateLineCommand {
  op: 'createLine';
  id: string;
  name?: string;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  strokes?: SolidFill[];
  strokeWeight?: number;
}

export interface CreateTextCommand {
  op: 'createText';
  id: string;
  name?: string;
  characters: string;
  fontSize: number;
  fontFamily: string;
  fontStyle: string;
  fills?: SolidFill[];
  textAlignHorizontal?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
  textAutoResize?: 'NONE' | 'HEIGHT' | 'WIDTH_AND_HEIGHT';
  opacity?: number;
  x?: number;
  y?: number;
}

export interface AppendChildCommand {
  op: 'appendChild';
  parentId: string;
  childId: string;
}

export interface GroupCommand {
  op: 'group';
  id: string;
  name?: string;
  childIds: string[];
  parentId: string;
  index?: number;
}

export type FigmaCommand =
  | LoadFontCommand
  | CreateFrameCommand
  | CreateRectangleCommand
  | CreateEllipseCommand
  | CreateLineCommand
  | CreateTextCommand
  | AppendChildCommand
  | GroupCommand;

export interface FigmaExecutorResponse {
  thinking: string;
  commands: FigmaCommand[];
  rootId: string;
}

// --- JSON Schema for OpenAI Structured Output (strict) ---

const rgbSchema = {
  type: 'object',
  properties: {
    r: { type: 'number', description: 'Red 0-1' },
    g: { type: 'number', description: 'Green 0-1' },
    b: { type: 'number', description: 'Blue 0-1' },
  },
  required: ['r', 'g', 'b'],
  additionalProperties: false,
};

const solidFillSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['SOLID'] },
    color: rgbSchema,
    opacity: { type: 'number' },
  },
  required: ['type', 'color', 'opacity'],
  additionalProperties: false,
};

const loadFontSchema = {
  type: 'object',
  properties: {
    op: { type: 'string', const: 'loadFont' },
    family: { type: 'string' },
    style: { type: 'string' },
  },
  required: ['op', 'family', 'style'],
  additionalProperties: false,
};

const createFrameSchema = {
  type: 'object',
  properties: {
    op: { type: 'string', const: 'createFrame' },
    id: { type: 'string' },
    name: { type: 'string' },
    width: { type: 'number' },
    height: { type: 'number' },
    layoutMode: { type: 'string', enum: ['NONE', 'HORIZONTAL', 'VERTICAL'] },
    primaryAxisSizingMode: { type: 'string', enum: ['FIXED', 'AUTO'] },
    counterAxisSizingMode: { type: 'string', enum: ['FIXED', 'AUTO'] },
    primaryAxisAlignItems: { type: 'string', enum: ['MIN', 'CENTER', 'MAX', 'SPACE_BETWEEN'] },
    counterAxisAlignItems: { type: 'string', enum: ['MIN', 'CENTER', 'MAX', 'BASELINE'] },
    itemSpacing: { type: 'number' },
    paddingTop: { type: 'number' },
    paddingBottom: { type: 'number' },
    paddingLeft: { type: 'number' },
    paddingRight: { type: 'number' },
    fills: { type: 'array', items: solidFillSchema },
    strokes: { type: 'array', items: solidFillSchema },
    strokeWeight: { type: 'number' },
    cornerRadius: { type: 'number' },
    clipsContent: { type: 'boolean' },
    opacity: { type: 'number' },
    x: { type: 'number' },
    y: { type: 'number' },
  },
  required: ['op', 'id', 'width', 'height'],
  additionalProperties: false,
};

const createRectangleSchema = {
  type: 'object',
  properties: {
    op: { type: 'string', const: 'createRectangle' },
    id: { type: 'string' },
    name: { type: 'string' },
    width: { type: 'number' },
    height: { type: 'number' },
    fills: { type: 'array', items: solidFillSchema },
    strokes: { type: 'array', items: solidFillSchema },
    strokeWeight: { type: 'number' },
    cornerRadius: { type: 'number' },
    opacity: { type: 'number' },
    x: { type: 'number' },
    y: { type: 'number' },
  },
  required: ['op', 'id', 'width', 'height'],
  additionalProperties: false,
};

const createEllipseSchema = {
  type: 'object',
  properties: {
    op: { type: 'string', const: 'createEllipse' },
    id: { type: 'string' },
    name: { type: 'string' },
    width: { type: 'number' },
    height: { type: 'number' },
    fills: { type: 'array', items: solidFillSchema },
    strokes: { type: 'array', items: solidFillSchema },
    strokeWeight: { type: 'number' },
    opacity: { type: 'number' },
    x: { type: 'number' },
    y: { type: 'number' },
  },
  required: ['op', 'id', 'width', 'height'],
  additionalProperties: false,
};

const createLineSchema = {
  type: 'object',
  properties: {
    op: { type: 'string', const: 'createLine' },
    id: { type: 'string' },
    name: { type: 'string' },
    x1: { type: 'number' },
    y1: { type: 'number' },
    x2: { type: 'number' },
    y2: { type: 'number' },
    strokes: { type: 'array', items: solidFillSchema },
    strokeWeight: { type: 'number' },
  },
  required: ['op', 'id'],
  additionalProperties: false,
};

const createTextSchema = {
  type: 'object',
  properties: {
    op: { type: 'string', const: 'createText' },
    id: { type: 'string' },
    name: { type: 'string' },
    characters: { type: 'string' },
    fontSize: { type: 'number' },
    fontFamily: { type: 'string' },
    fontStyle: { type: 'string' },
    fills: { type: 'array', items: solidFillSchema },
    textAlignHorizontal: { type: 'string', enum: ['LEFT', 'CENTER', 'RIGHT', 'JUSTIFIED'] },
    textAutoResize: { type: 'string', enum: ['NONE', 'HEIGHT', 'WIDTH_AND_HEIGHT'] },
    opacity: { type: 'number' },
    x: { type: 'number' },
    y: { type: 'number' },
  },
  required: ['op', 'id', 'characters', 'fontSize', 'fontFamily', 'fontStyle'],
  additionalProperties: false,
};

const appendChildSchema = {
  type: 'object',
  properties: {
    op: { type: 'string', const: 'appendChild' },
    parentId: { type: 'string' },
    childId: { type: 'string' },
  },
  required: ['op', 'parentId', 'childId'],
  additionalProperties: false,
};

const groupSchema = {
  type: 'object',
  properties: {
    op: { type: 'string', const: 'group' },
    id: { type: 'string' },
    name: { type: 'string' },
    childIds: { type: 'array', items: { type: 'string' } },
    parentId: { type: 'string' },
    index: { type: 'number' },
  },
  required: ['op', 'id', 'childIds', 'parentId'],
  additionalProperties: false,
};

// OpenAI json_schema may not support oneOf inside array items; use generic object for items.
// The command interpreter validates each command at runtime.
export const FIGMA_COMMAND_JSON_SCHEMA = {
  name: 'figma_executor_response',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      thinking: { type: 'string', description: 'Brief reasoning for the command structure' },
      commands: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            op: { type: 'string' },
            id: { type: ['string', 'null'] },
            name: { type: ['string', 'null'] },
            family: { type: ['string', 'null'] },
            style: { type: ['string', 'null'] },
            width: { type: ['number', 'null'] },
            height: { type: ['number', 'null'] },
            layoutMode: { type: ['string', 'null'] },
            characters: { type: ['string', 'null'] },
            fontSize: { type: ['number', 'null'] },
            fontFamily: { type: ['string', 'null'] },
            fontStyle: { type: ['string', 'null'] },
            parentId: { type: ['string', 'null'] },
            childId: { type: ['string', 'null'] },
            childIds: { type: ['array', 'null'], items: { type: 'string' } },
            index: { type: ['number', 'null'] },
            fills: { type: ['array', 'null'], items: solidFillSchema },
            strokes: { type: ['array', 'null'], items: solidFillSchema },
            strokeWeight: { type: ['number', 'null'] },
            cornerRadius: { type: ['number', 'null'] },
            itemSpacing: { type: ['number', 'null'] },
            paddingTop: { type: ['number', 'null'] },
            paddingBottom: { type: ['number', 'null'] },
            paddingLeft: { type: ['number', 'null'] },
            paddingRight: { type: ['number', 'null'] },
            primaryAxisSizingMode: { type: ['string', 'null'] },
            counterAxisSizingMode: { type: ['string', 'null'] },
            primaryAxisAlignItems: { type: ['string', 'null'] },
            counterAxisAlignItems: { type: ['string', 'null'] },
            clipsContent: { type: ['boolean', 'null'] },
            opacity: { type: ['number', 'null'] },
            x: { type: ['number', 'null'] },
            y: { type: ['number', 'null'] },
            x1: { type: ['number', 'null'] },
            y1: { type: ['number', 'null'] },
            x2: { type: ['number', 'null'] },
            y2: { type: ['number', 'null'] },
            textAlignHorizontal: { type: ['string', 'null'] },
            textAutoResize: { type: ['string', 'null'] },
          },
          required: [
            'op', 'id', 'name', 'family', 'style', 'width', 'height', 'layoutMode', 'characters',
            'fontSize', 'fontFamily', 'fontStyle', 'parentId', 'childId', 'childIds', 'index',
            'fills', 'strokes', 'strokeWeight', 'cornerRadius', 'itemSpacing',
            'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
            'primaryAxisSizingMode', 'counterAxisSizingMode', 'primaryAxisAlignItems', 'counterAxisAlignItems',
            'clipsContent', 'opacity', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
            'textAlignHorizontal', 'textAutoResize',
          ],
          additionalProperties: false,
        },
      },
      rootId: { type: 'string', description: 'ID of the root node to attach to context' },
    },
    required: ['thinking', 'commands', 'rootId'],
    additionalProperties: false,
  },
};
