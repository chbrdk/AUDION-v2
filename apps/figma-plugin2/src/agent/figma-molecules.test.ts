/**
 * Unit tests for createButton molecule (uses only atoms).
 * Run with Jest or similar if configured.
 */

import type { NodeMap, FigmaApiLike } from './figma-atoms';
import { createFrame, createRectangle } from './figma-atoms';
import {
  createButton,
  createSection,
  addText,
  createStage,
  createRow,
  addPlaceholderImage,
  createCard,
  createDivider,
  createAvatar,
  createBadge,
  createSpacer,
  createInput,
  createForm,
  createTable,
  createButtonRow,
  setLayout,
  createCheckbox,
  createRadio,
  createTextarea,
  createList,
  createHeader,
  createHero,
  addSvg,
  createIconButton,
  type ToolContext,
} from './figma-molecules';

function createMockNode(id: string) {
  const children: unknown[] = [];
  return {
    id,
    _children: children,
    appendChild(child: unknown) {
      children.push(child);
    },
    resize(_w: number, _h: number) {},
    get name() {
      return (this as any)._name;
    },
    set name(v: string) {
      (this as any)._name = v;
    },
  };
}

function createMockApi(): FigmaApiLike {
  const created = {
    frames: [] as any[],
    rects: [] as any[],
    ellipses: [] as any[],
    lines: [] as any[],
    texts: [] as any[],
  };
  return {
    loadFontAsync: async () => {},
    createFrame: () => {
      const id = `frame_${created.frames.length}`;
      const node = createMockNode(id) as unknown as FrameNode;
      Object.assign(node, {
        layoutMode: 'NONE',
        primaryAxisSizingMode: 'FIXED',
        counterAxisSizingMode: 'FIXED',
        itemSpacing: 0,
        paddingTop: 0,
        paddingBottom: 0,
        paddingLeft: 0,
        paddingRight: 0,
        fills: [],
        strokes: [],
        strokeWeight: 0,
        cornerRadius: 0,
        opacity: 1,
        x: 0,
        y: 0,
      });
      created.frames.push(node);
      return node;
    },
    createRectangle: () => {
      const id = `rect_${created.rects.length}`;
      const node = createMockNode(id) as unknown as RectangleNode;
      Object.assign(node, { fills: [], strokes: [], strokeWeight: 0, cornerRadius: 0, opacity: 1, x: 0, y: 0 });
      created.rects.push(node);
      return node;
    },
    createEllipse: () => {
      const id = `ellipse_${created.ellipses.length}`;
      const node = createMockNode(id) as unknown as EllipseNode;
      Object.assign(node, { fills: [], strokes: [], strokeWeight: 0, opacity: 1, x: 0, y: 0 });
      created.ellipses.push(node);
      return node;
    },
    createLine: () => {
      const id = `line_${created.lines.length}`;
      const node = createMockNode(id) as unknown as LineNode;
      Object.assign(node, { strokes: [], strokeWeight: 1, x: 0, y: 0 });
      created.lines.push(node);
      return node;
    },
    createText: () => {
      const id = `text_${created.texts.length}`;
      const node = createMockNode(id) as unknown as TextNode;
      Object.assign(node, { fontName: { family: 'Inter', style: 'Regular' }, characters: '', fontSize: 14, fills: [], width: 40, height: 14 });
      created.texts.push(node);
      return node;
    },
    group: (nodes, parent, _index) => {
      const id = `group_${created.frames.length}`;
      const groupNode = createMockNode(id) as unknown as GroupNode;
      for (const n of nodes) (groupNode as BaseNode & ChildrenMixin).appendChild(n);
      (parent as BaseNode & ChildrenMixin).appendChild(groupNode);
      return groupNode;
    },
    createNodeFromSvg: (_svg: string) => {
      const id = `svg_${created.frames.length}`;
      const node = createMockNode(id) as unknown as FrameNode;
      Object.assign(node, { width: 24, height: 24, resize: (w: number, h: number) => {} });
      created.frames.push(node);
      return node;
    },
  };
}

describe('figma-molecules createButton', () => {
  it('returns error when parentId not in nodeMap', async () => {
    const nodeMap: NodeMap = new Map();
    const context: ToolContext = { nodeMap, api: createMockApi() };
    const result = await createButton(context, { parentId: 'missing', label: 'Click' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('parent "missing"');
  });

  it('creates button and returns buttonId when parent exists', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'root', name: 'Root', width: 400, height: 300 }, api);
    const context: ToolContext = { nodeMap, api };
    const result = await createButton(context, { parentId: 'root', label: 'Mehr erfahren', variant: 'outline' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.buttonId).toBeDefined();
      expect(nodeMap.get(result.buttonId)).toBeDefined();
    }
  });

  it('createButton uses only atoms: frame, rect, text, appendChild', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'root', width: 400, height: 300 }, api);
    const result = await createButton(
      { nodeMap, api },
      { parentId: 'root', label: 'OK', variant: 'primary' }
    );
    expect(result.success).toBe(true);
    if (result.success) {
      const buttonNode = nodeMap.get(result.buttonId);
      expect(buttonNode).toBeDefined();
      const parent = nodeMap.get('root') as any;
      expect(parent._children).toContain(buttonNode);
    }
  });
});

describe('figma-molecules createStage', () => {
  it('creates stage and returns stageId', () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    const context: ToolContext = { nodeMap, api };
    const result = createStage(context, { width: 1440, height: 1024, name: 'Wireframe' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.stageId).toBeDefined();
      expect(nodeMap.get(result.stageId)).toBeDefined();
    }
  });
});

describe('figma-molecules createSection', () => {
  it('returns error when parentId not in nodeMap', () => {
    const nodeMap: NodeMap = new Map();
    const result = createSection(
      { nodeMap, api: createMockApi() },
      { parentId: 'missing', name: 'Hero' }
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('parent "missing"');
  });

  it('creates section inside parent and returns sectionId', () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'stage', name: 'Stage', width: 1440, height: 1024 }, api);
    const context: ToolContext = { nodeMap, api };
    const result = createSection(context, { parentId: 'stage', name: 'Hero', direction: 'vertical', gap: 12, padding: 16 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.sectionId).toBeDefined();
      expect(nodeMap.get(result.sectionId)).toBeDefined();
      const parent = nodeMap.get('stage') as any;
      expect(parent._children).toContain(nodeMap.get(result.sectionId));
    }
  });

  it('section frame has layout and padding', () => {
    const nodeMap: NodeMap = new Map();
    createFrame(nodeMap, { id: 'stage', width: 800, height: 600 }, createMockApi());
    const result = createSection(
      { nodeMap, api: createMockApi() },
      { parentId: 'stage', name: 'Features', direction: 'horizontal', gap: 8, padding: 24 }
    );
    expect(result.success).toBe(true);
    if (result.success) {
      const frame = nodeMap.get(result.sectionId) as any;
      expect(frame).toBeDefined();
      expect(frame.layoutMode).toBe('HORIZONTAL');
      expect(frame.itemSpacing).toBe(8);
      expect(frame.paddingTop).toBe(24);
    }
  });

  it('applies spacing preset spacious', () => {
    const nodeMap: NodeMap = new Map();
    createFrame(nodeMap, { id: 'stage', width: 800, height: 600 }, createMockApi());
    const result = createSection(
      { nodeMap, api: createMockApi() },
      { parentId: 'stage', name: 'Hero', spacing: 'spacious' }
    );
    expect(result.success).toBe(true);
    if (result.success) {
      const frame = nodeMap.get(result.sectionId) as any;
      expect(frame.itemSpacing).toBe(24);
      expect(frame.paddingTop).toBe(32);
    }
  });
});

describe('figma-molecules createRow', () => {
  it('returns error when parentId not in nodeMap', () => {
    const nodeMap: NodeMap = new Map();
    const result = createRow({ nodeMap, api: createMockApi() }, { parentId: 'missing', name: 'Features row' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('parent "missing"');
  });

  it('creates row inside parent and returns rowId', () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'stage', name: 'Stage', width: 1440, height: 1024 }, api);
    const result = createRow({ nodeMap, api }, { parentId: 'stage', name: 'Features row', gap: 24 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.rowId).toBeDefined();
      const row = nodeMap.get(result.rowId) as any;
      expect(row).toBeDefined();
      expect(row.layoutMode).toBe('HORIZONTAL');
      expect(row.itemSpacing).toBe(24);
      const parent = nodeMap.get('stage') as any;
      expect(parent._children).toContain(row);
    }
  });
});

describe('figma-molecules addText', () => {
  it('returns error when parentId not in nodeMap', async () => {
    const nodeMap: NodeMap = new Map();
    const context: ToolContext = { nodeMap, api: createMockApi() };
    const result = await addText(context, { parentId: 'missing', content: 'Hello' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('parent "missing"');
  });

  it('adds text and returns textId when parent exists', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'root', name: 'Root', width: 400, height: 300 }, api);
    const context: ToolContext = { nodeMap, api };
    const result = await addText(context, { parentId: 'root', content: 'Heading', variant: 'h1' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.textId).toBeDefined();
      expect(nodeMap.get(result.textId)).toBeDefined();
      const parent = nodeMap.get('root') as any;
      expect(parent._children).toContain(nodeMap.get(result.textId));
    }
  });
});

describe('figma-molecules addPlaceholderImage', () => {
  it('returns error when parentId not in nodeMap', async () => {
    const nodeMap: NodeMap = new Map();
    const result = await addPlaceholderImage(
      { nodeMap, api: createMockApi() },
      { parentId: 'missing', width: 200, height: 120 }
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('parent "missing"');
  });

  it('adds placeholder rectangle when parent exists', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'root', name: 'Root', width: 400, height: 300 }, api);
    const context: ToolContext = { nodeMap, api };
    const result = await addPlaceholderImage(context, { parentId: 'root', width: 200, height: 120 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.placeholderId).toBeDefined();
      expect(nodeMap.get(result.placeholderId)).toBeDefined();
      const parent = nodeMap.get('root') as any;
      expect(parent._children).toContain(nodeMap.get(result.placeholderId));
    }
  });
});

describe('figma-molecules createButtonRow', () => {
  it('returns error when parentId not in nodeMap', async () => {
    const nodeMap: NodeMap = new Map();
    const result = await createButtonRow(
      { nodeMap, api: createMockApi() },
      { parentId: 'missing', buttons: [{ label: 'OK' }, { label: 'Cancel', variant: 'outline' }] }
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('parent "missing"');
  });

  it('returns error when buttons array is empty', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'root', width: 400, height: 300 }, api);
    const result = await createButtonRow({ nodeMap, api }, { parentId: 'root', buttons: [] });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('buttons');
  });

  it('creates horizontal button row and returns buttonRowId and buttonIds', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'root', width: 400, height: 300 }, api);
    const result = await createButtonRow(
      { nodeMap, api },
      { parentId: 'root', buttons: [{ label: 'Weiter', variant: 'primary' }, { label: 'Abbrechen', variant: 'outline' }], direction: 'horizontal' }
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.buttonRowId).toBeDefined();
      expect(result.buttonIds).toHaveLength(2);
      expect(nodeMap.get(result.buttonRowId)).toBeDefined();
      const parent = nodeMap.get('root') as any;
      expect(parent._children).toContain(nodeMap.get(result.buttonRowId));
    }
  });
});

describe('figma-molecules createCard', () => {
  it('returns error when parentId not in nodeMap', async () => {
    const nodeMap: NodeMap = new Map();
    const result = await createCard(
      { nodeMap, api: createMockApi() },
      { parentId: 'missing', title: 'Feature' }
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('parent "missing"');
  });

  it('creates card with title and appends to parent', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'row', name: 'Row', width: 800, height: 300 }, api);
    const context: ToolContext = { nodeMap, api };
    const result = await createCard(context, {
      parentId: 'row',
      title: 'Feature One',
      description: 'Short desc',
      buttonLabel: 'Mehr',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.cardId).toBeDefined();
      expect(nodeMap.get(result.cardId)).toBeDefined();
      const parent = nodeMap.get('row') as any;
      expect(parent._children).toContain(nodeMap.get(result.cardId));
    }
  });
});

describe('figma-molecules createDivider', () => {
  it('returns error when parentId not in nodeMap', () => {
    const nodeMap: NodeMap = new Map();
    const result = createDivider({ nodeMap, api: createMockApi() }, { parentId: 'missing', orientation: 'horizontal' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('parent "missing"');
  });

  it('creates divider and returns dividerId when parent exists', () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'root', width: 400, height: 300 }, api);
    const result = createDivider({ nodeMap, api }, { parentId: 'root', length: 200 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.dividerId).toBeDefined();
      expect(nodeMap.get(result.dividerId)).toBeDefined();
    }
  });
});

describe('figma-molecules createAvatar', () => {
  it('returns error when parentId not in nodeMap', async () => {
    const nodeMap: NodeMap = new Map();
    const result = await createAvatar({ nodeMap, api: createMockApi() }, { parentId: 'missing', initials: 'AB' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('parent "missing"');
  });

  it('creates avatar and returns avatarId when parent exists', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'root', width: 400, height: 300 }, api);
    const result = await createAvatar({ nodeMap, api }, { parentId: 'root', initials: 'AB', size: 40 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.avatarId).toBeDefined();
      expect(nodeMap.get(result.avatarId)).toBeDefined();
    }
  });
});

describe('figma-molecules createBadge', () => {
  it('returns error when parentId not in nodeMap', async () => {
    const nodeMap: NodeMap = new Map();
    const result = await createBadge({ nodeMap, api: createMockApi() }, { parentId: 'missing', label: 'Neu' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('parent "missing"');
  });

  it('creates badge and returns badgeId when parent exists', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'root', width: 400, height: 300 }, api);
    const result = await createBadge({ nodeMap, api }, { parentId: 'root', label: 'Sale' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.badgeId).toBeDefined();
      expect(nodeMap.get(result.badgeId)).toBeDefined();
    }
  });
});

describe('figma-molecules createSpacer', () => {
  it('returns error when parentId not in nodeMap', () => {
    const nodeMap: NodeMap = new Map();
    const result = createSpacer({ nodeMap, api: createMockApi() }, { parentId: 'missing', width: 16, height: 16 });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('parent "missing"');
  });

  it('creates spacer and returns spacerId when parent exists', () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'root', width: 400, height: 300 }, api);
    const result = createSpacer({ nodeMap, api }, { parentId: 'root', width: 24, height: 8 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.spacerId).toBeDefined();
      expect(nodeMap.get(result.spacerId)).toBeDefined();
    }
  });
});

describe('figma-molecules createInput', () => {
  it('returns error when parentId not in nodeMap', async () => {
    const nodeMap: NodeMap = new Map();
    const result = await createInput({ nodeMap, api: createMockApi() }, { parentId: 'missing', label: 'Email' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('parent "missing"');
  });

  it('creates input and returns inputId when parent exists', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'root', width: 400, height: 300 }, api);
    const result = await createInput({ nodeMap, api }, { parentId: 'root', label: 'Email', placeholder: 'you@example.com' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.inputId).toBeDefined();
      expect(nodeMap.get(result.inputId)).toBeDefined();
    }
  });
});

describe('figma-molecules createForm', () => {
  it('returns error when parentId not in nodeMap', async () => {
    const nodeMap: NodeMap = new Map();
    const result = await createForm(
      { nodeMap, api: createMockApi() },
      { parentId: 'missing', fields: [{ label: 'Email' }, { label: 'Password', placeholder: '••••' }] }
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('parent "missing"');
  });

  it('returns error when fields is empty', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'root', width: 400, height: 300 }, api);
    const result = await createForm({ nodeMap, api }, { parentId: 'root', fields: [] });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('fields');
  });

  it('creates form and returns formId when parent exists', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'root', width: 400, height: 300 }, api);
    const result = await createForm(
      { nodeMap, api },
      { parentId: 'root', fields: [{ label: 'Email', placeholder: 'you@example.com' }], title: 'Login' }
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.formId).toBeDefined();
      expect(nodeMap.get(result.formId)).toBeDefined();
    }
  });
});

describe('figma-molecules createTable', () => {
  it('returns error when parentId not in nodeMap', async () => {
    const nodeMap: NodeMap = new Map();
    const result = await createTable({ nodeMap, api: createMockApi() }, { parentId: 'missing', columns: 3, rows: 4 });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('parent "missing"');
  });

  it('creates table and returns tableId when parent exists', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'root', width: 600, height: 400 }, api);
    const result = await createTable(
      { nodeMap, api },
      { parentId: 'root', columns: 3, rows: 2, headerRow: ['A', 'B', 'C'] }
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.tableId).toBeDefined();
      expect(nodeMap.get(result.tableId)).toBeDefined();
    }
  });
});

describe('figma-molecules setLayout', () => {
  it('returns error when nodeId not in nodeMap', () => {
    const nodeMap: NodeMap = new Map();
    const result = setLayout({ nodeMap }, { nodeId: 'missing' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('not found');
  });

  it('returns error when node is not a Frame', () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'root', width: 100, height: 100 }, api);
    createRectangle(nodeMap, { id: 'rect1', width: 50, height: 50 }, api);
    const result = setLayout({ nodeMap }, { nodeId: 'rect1', itemSpacing: 8 });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('not a Frame');
  });

  it('updates frame layout when node is a frame', () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'sec', width: 400, height: 300, layoutMode: 'VERTICAL' }, api);
    const result = setLayout({ nodeMap }, { nodeId: 'sec', itemSpacing: 12, counterAxisAlignItems: 'CENTER' });
    expect(result.success).toBe(true);
    const frame = nodeMap.get('sec') as FrameNode;
    expect(frame.itemSpacing).toBe(12);
    expect(frame.counterAxisAlignItems).toBe('CENTER');
  });
});

describe('figma-molecules createCheckbox', () => {
  it('returns error when parentId not in nodeMap', async () => {
    const nodeMap: NodeMap = new Map();
    const result = await createCheckbox({ nodeMap, api: createMockApi() }, { parentId: 'missing', label: 'OK' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('parent "missing"');
  });

  it('creates checkbox and returns checkboxId when parent exists', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'root', width: 400, height: 300 }, api);
    const result = await createCheckbox({ nodeMap, api }, { parentId: 'root', label: 'Agree', checked: false });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.checkboxId).toBeDefined();
      expect(nodeMap.get(result.checkboxId)).toBeDefined();
    }
  });
});

describe('figma-molecules createRadio', () => {
  it('returns error when parentId not in nodeMap', async () => {
    const nodeMap: NodeMap = new Map();
    const result = await createRadio({ nodeMap, api: createMockApi() }, { parentId: 'missing', label: 'A' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('parent "missing"');
  });

  it('creates radio and returns radioId when parent exists', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'root', width: 400, height: 300 }, api);
    const result = await createRadio({ nodeMap, api }, { parentId: 'root', label: 'Option A', selected: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.radioId).toBeDefined();
      expect(nodeMap.get(result.radioId)).toBeDefined();
    }
  });
});

describe('figma-molecules createTextarea', () => {
  it('returns error when parentId not in nodeMap', async () => {
    const nodeMap: NodeMap = new Map();
    const result = await createTextarea({ nodeMap, api: createMockApi() }, { parentId: 'missing', placeholder: 'Message' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('parent "missing"');
  });

  it('creates textarea and returns textareaId when parent exists', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'root', width: 400, height: 300 }, api);
    const result = await createTextarea({ nodeMap, api }, { parentId: 'root', label: 'Message', rows: 4 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.textareaId).toBeDefined();
      expect(nodeMap.get(result.textareaId)).toBeDefined();
    }
  });
});

describe('figma-molecules createList', () => {
  it('returns error when parentId not in nodeMap', async () => {
    const nodeMap: NodeMap = new Map();
    const result = await createList({ nodeMap, api: createMockApi() }, { parentId: 'missing', items: ['A', 'B'] });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('parent "missing"');
  });

  it('returns error when items is empty', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'root', width: 400, height: 300 }, api);
    const result = await createList({ nodeMap, api }, { parentId: 'root', items: [] });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('items');
  });

  it('creates list and returns listId when parent exists', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'root', width: 400, height: 300 }, api);
    const result = await createList({ nodeMap, api }, { parentId: 'root', items: ['First', 'Second'], variant: 'bullet' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.listId).toBeDefined();
      expect(nodeMap.get(result.listId)).toBeDefined();
    }
  });
});

describe('figma-molecules createHeader', () => {
  it('returns error when parentId not in nodeMap', async () => {
    const nodeMap: NodeMap = new Map();
    const result = await createHeader({ nodeMap, api: createMockApi() }, { parentId: 'missing' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('parent "missing"');
  });

  it('creates header and returns headerId when parent exists', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'stage', width: 800, height: 600 }, api);
    const result = await createHeader(
      { nodeMap, api },
      { parentId: 'stage', logoLabel: 'Logo', navItems: ['Home', 'About'], ctaLabel: 'CTA' }
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.headerId).toBeDefined();
      expect(nodeMap.get(result.headerId)).toBeDefined();
    }
  });
});

describe('figma-molecules createHero', () => {
  it('returns error when parentId not in nodeMap', async () => {
    const nodeMap: NodeMap = new Map();
    const result = await createHero({ nodeMap, api: createMockApi() }, { parentId: 'missing', title: 'Hero' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('parent "missing"');
  });

  it('returns error when title is empty', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'root', width: 600, height: 400 }, api);
    const result = await createHero({ nodeMap, api }, { parentId: 'root', title: '' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('title');
  });

  it('creates hero and returns heroId when parent exists', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'stage', width: 600, height: 500 }, api);
    const result = await createHero(
      { nodeMap, api },
      { parentId: 'stage', title: 'Welcome', subtitle: 'Sub', ctaLabel: 'Start' }
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.heroId).toBeDefined();
      expect(nodeMap.get(result.heroId)).toBeDefined();
    }
  });
});

describe('figma-molecules addSvg', () => {
  it('returns error when parentId not in nodeMap', () => {
    const nodeMap: NodeMap = new Map();
    const result = addSvg(
      { nodeMap, api: createMockApi() },
      { parentId: 'missing', svgCode: '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h24v24H0z"/></svg>' }
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('parent "missing"');
  });

  it('adds svg and returns svgId when parent exists', () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'root', width: 400, height: 300 }, api);
    const result = addSvg(
      { nodeMap, api },
      { parentId: 'root', svgCode: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 18h18v-2H3v2z"/></svg>', width: 24, height: 24 }
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.svgId).toBeDefined();
      expect(nodeMap.get(result.svgId)).toBeDefined();
    }
  });
});

describe('figma-molecules createIconButton', () => {
  it('returns error when neither iconSvg nor label provided', async () => {
    const nodeMap: NodeMap = new Map();
    createFrame(nodeMap, { id: 'root', width: 400, height: 300 }, createMockApi());
    const result = await createIconButton({ nodeMap, api: createMockApi() }, { parentId: 'root' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('iconSvg');
  });

  it('creates label-only button (delegates to createButton)', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'root', width: 400, height: 300 }, api);
    const result = await createIconButton({ nodeMap, api }, { parentId: 'root', label: 'OK' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.buttonId).toBeDefined();
  });

  it('creates icon-only button when iconSvg provided', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'root', width: 400, height: 300 }, api);
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
    const result = await createIconButton({ nodeMap, api }, { parentId: 'root', iconSvg: svg });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.buttonId).toBeDefined();
      expect(nodeMap.get(result.buttonId)).toBeDefined();
    }
  });
});
