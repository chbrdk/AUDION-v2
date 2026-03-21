/**
 * Design Spec Schema – Neutral design tree (no Figma API terms).
 * Used by the Design Spec agent; the Figma Executor translates this into commands.
 */

export type DesignSpecLayout = {
  direction?: 'vertical' | 'horizontal';
  gap?: number;
  padding?: number | { top?: number; right?: number; bottom?: number; left?: number; vertical?: number; horizontal?: number };
  align?: 'start' | 'center' | 'end' | 'spaceBetween';
  alignVertical?: 'start' | 'center' | 'end';
};

export type DesignSpecNode =
  | DesignSpecContainer
  | DesignSpecText
  | DesignSpecPlaceholder
  | DesignSpecButton
  | DesignSpecDivider
  | DesignSpecAvatar;

export interface DesignSpecContainer {
  type: 'container';
  name?: string;
  layout?: DesignSpecLayout;
  fill?: string;
  stroke?: string;
  cornerRadius?: number;
  opacity?: number;
  children: DesignSpecNode[];
}

export interface DesignSpecText {
  type: 'text';
  content: string;
  variant?: 'h1' | 'h2' | 'h3' | 'body' | 'small' | 'caption';
  align?: 'left' | 'center' | 'right';
}

export interface DesignSpecPlaceholder {
  type: 'placeholder';
  width: number;
  height: number;
  label?: string;
  fill?: string;
}

export interface DesignSpecButton {
  type: 'button';
  label: string;
  variant?: 'primary' | 'secondary' | 'outline';
  width?: number;
}

export interface DesignSpecDivider {
  type: 'divider';
  width?: number;
}

export interface DesignSpecAvatar {
  type: 'avatar';
  size: number;
  initials?: string;
}

export interface DesignSpecRoot {
  thinking?: string;
  root: DesignSpecNode;
}

// --- JSON Schema for OpenAI Structured Output (Design Spec agent) ---

const layoutSchema = {
  type: 'object',
  properties: {
    direction: { type: 'string', enum: ['vertical', 'horizontal'] },
    gap: { type: 'number' },
    padding: {
      oneOf: [
        { type: 'number' },
        {
          type: 'object',
          properties: {
            top: { type: 'number' },
            right: { type: 'number' },
            bottom: { type: 'number' },
            left: { type: 'number' },
            vertical: { type: 'number' },
            horizontal: { type: 'number' },
          },
          additionalProperties: false,
        },
      ],
    },
    align: { type: 'string', enum: ['start', 'center', 'end', 'spaceBetween'] },
    alignVertical: { type: 'string', enum: ['start', 'center', 'end'] },
  },
  additionalProperties: false,
};

const containerSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', const: 'container' },
    name: { type: 'string' },
    layout: layoutSchema,
    fill: { type: 'string' },
    stroke: { type: 'string' },
    cornerRadius: { type: 'number' },
    opacity: { type: 'number' },
    children: {
      type: 'array',
      items: { $ref: '#/$defs/designSpecNode' },
    },
  },
  required: ['type', 'children'],
  additionalProperties: false,
};

const textSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', const: 'text' },
    content: { type: 'string' },
    variant: { type: 'string', enum: ['h1', 'h2', 'h3', 'body', 'small', 'caption'] },
    align: { type: 'string', enum: ['left', 'center', 'right'] },
  },
  required: ['type', 'content'],
  additionalProperties: false,
};

const placeholderSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', const: 'placeholder' },
    width: { type: 'number' },
    height: { type: 'number' },
    label: { type: 'string' },
    fill: { type: 'string' },
  },
  required: ['type', 'width', 'height'],
  additionalProperties: false,
};

const buttonSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', const: 'button' },
    label: { type: 'string' },
    variant: { type: 'string', enum: ['primary', 'secondary', 'outline'] },
    width: { type: 'number' },
  },
  required: ['type', 'label'],
  additionalProperties: false,
};

const dividerSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', const: 'divider' },
    width: { type: 'number' },
  },
  required: ['type'],
  additionalProperties: false,
};

const avatarSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', const: 'avatar' },
    size: { type: 'number' },
    initials: { type: 'string' },
  },
  required: ['type', 'size'],
  additionalProperties: false,
};

export const DESIGN_SPEC_JSON_SCHEMA = {
  name: 'design_spec_response',
  strict: true,
  schema: {
    type: 'object',
    $defs: {
      designSpecNode: {
        oneOf: [
          { ...containerSchema, properties: { ...containerSchema.properties, children: { type: 'array', items: { $ref: '#/$defs/designSpecNode' } } } },
          textSchema,
          placeholderSchema,
          buttonSchema,
          dividerSchema,
          avatarSchema,
        ],
      },
    },
    properties: {
      thinking: { type: 'string' },
      root: { $ref: '#/$defs/designSpecNode' },
    },
    required: ['root'],
    additionalProperties: false,
  },
};

// Flattened schema without $ref for OpenAI (they may not support $ref in json_schema)
function buildDesignSpecNodeSchema(): object {
  return {
    oneOf: [
      {
        type: 'object',
        properties: {
          type: { type: 'string', const: 'container' },
          name: { type: 'string' },
          layout: layoutSchema,
          fill: { type: 'string' },
          stroke: { type: 'string' },
          cornerRadius: { type: 'number' },
          opacity: { type: 'number' },
          children: { type: 'array', items: { type: 'object' } },
        },
        required: ['type', 'children'],
        additionalProperties: false,
      },
      {
        type: 'object',
        properties: {
          type: { type: 'string', const: 'text' },
          content: { type: 'string' },
          variant: { type: 'string', enum: ['h1', 'h2', 'h3', 'body', 'small', 'caption'] },
          align: { type: 'string', enum: ['left', 'center', 'right'] },
        },
        required: ['type', 'content'],
        additionalProperties: false,
      },
      {
        type: 'object',
        properties: {
          type: { type: 'string', const: 'placeholder' },
          width: { type: 'number' },
          height: { type: 'number' },
          label: { type: 'string' },
          fill: { type: 'string' },
        },
        required: ['type', 'width', 'height'],
        additionalProperties: false,
      },
      {
        type: 'object',
        properties: {
          type: { type: 'string', const: 'button' },
          label: { type: 'string' },
          variant: { type: 'string', enum: ['primary', 'secondary', 'outline'] },
          width: { type: 'number' },
        },
        required: ['type', 'label'],
        additionalProperties: false,
      },
      {
        type: 'object',
        properties: {
          type: { type: 'string', const: 'divider' },
          width: { type: 'number' },
        },
        required: ['type'],
        additionalProperties: false,
      },
      {
        type: 'object',
        properties: {
          type: { type: 'string', const: 'avatar' },
          size: { type: 'number' },
          initials: { type: 'string' },
        },
        required: ['type', 'size'],
        additionalProperties: false,
      },
    ],
  };
}

export const DESIGN_SPEC_JSON_SCHEMA_FLAT = {
  name: 'design_spec_response',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      thinking: { type: 'string' },
      root: buildDesignSpecNodeSchema(),
    },
    required: ['root'],
    additionalProperties: false,
  },
};
