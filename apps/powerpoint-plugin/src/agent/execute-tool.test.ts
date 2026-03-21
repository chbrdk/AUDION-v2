/**
 * Unit tests for executeTool dispatcher.
 */

import type { NodeMap, FigmaApiLike } from './figma-atoms';
import { createFrame, createRectangle, appendChild } from './figma-atoms';
import { executeTool } from './execute-tool';

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

describe('executeTool', () => {
  it('createSection returns success when parent exists', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'stage', name: 'Stage', width: 1440, height: 1024 }, api);
    const out = await executeTool(
      { nodeMap, api },
      'createSection',
      { parentId: 'stage', name: 'Hero', direction: 'vertical', spacing: 'spacious' }
    );
    expect(out.success).toBe(true);
    if (out.success && out.result.success) expect(out.result.sectionId).toBeDefined();
  });

  it('createRow returns success when parent exists', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'stage', name: 'Stage', width: 1440, height: 1024 }, api);
    const out = await executeTool(
      { nodeMap, api },
      'createRow',
      { parentId: 'stage', name: 'Features row', gap: 24 }
    );
    expect(out.success).toBe(true);
    if (out.success && out.result.success) expect(out.result.rowId).toBeDefined();
  });

  it('createButton returns success when parent exists', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'root', name: 'Root', width: 400, height: 300 }, api);
    const out = await executeTool(
      { nodeMap, api },
      'createButton',
      { parentId: 'root', label: 'OK', variant: 'outline' }
    );
    expect(out.success).toBe(true);
    if (out.success && out.result.success) expect(out.result.buttonId).toBeDefined();
  });

  it('addText returns success when parent exists', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'root', name: 'Root', width: 400, height: 300 }, api);
    const out = await executeTool(
      { nodeMap, api },
      'addText',
      { parentId: 'root', content: 'Hello', variant: 'body' }
    );
    expect(out.success).toBe(true);
    if (out.success && out.result.success) expect(out.result.textId).toBeDefined();
  });

  it('addPlaceholderImage returns success when parent exists', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'root', name: 'Root', width: 400, height: 300 }, api);
    const out = await executeTool(
      { nodeMap, api },
      'addPlaceholderImage',
      { parentId: 'root', width: 200, height: 120 }
    );
    expect(out.success).toBe(true);
    if (out.success && out.result.success) expect(out.result.placeholderId).toBeDefined();
  });

  it('createCard returns success when parent exists', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'row', name: 'Row', width: 800, height: 300 }, api);
    const out = await executeTool(
      { nodeMap, api },
      'createCard',
      { parentId: 'row', title: 'Feature', buttonLabel: 'Mehr' }
    );
    expect(out.success).toBe(true);
    if (out.success && out.result.success) expect(out.result.cardId).toBeDefined();
  });

  it('createDivider returns success when parent exists', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'root', width: 400, height: 300 }, api);
    const out = await executeTool(
      { nodeMap, api },
      'createDivider',
      { parentId: 'root', orientation: 'horizontal', length: 200 }
    );
    expect(out.success).toBe(true);
    if (out.success && out.result.success) expect(out.result.dividerId).toBeDefined();
  });

  it('createAvatar returns success when parent exists', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'root', width: 400, height: 300 }, api);
    const out = await executeTool(
      { nodeMap, api },
      'createAvatar',
      { parentId: 'root', initials: 'AB', size: 40 }
    );
    expect(out.success).toBe(true);
    if (out.success && out.result.success) expect(out.result.avatarId).toBeDefined();
  });

  it('createBadge returns success when parent exists', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'root', width: 400, height: 300 }, api);
    const out = await executeTool(
      { nodeMap, api },
      'createBadge',
      { parentId: 'root', label: 'Neu' }
    );
    expect(out.success).toBe(true);
    if (out.success && out.result.success) expect(out.result.badgeId).toBeDefined();
  });

  it('createSpacer returns success when parent exists', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'root', width: 400, height: 300 }, api);
    const out = await executeTool(
      { nodeMap, api },
      'createSpacer',
      { parentId: 'root', width: 16, height: 16 }
    );
    expect(out.success).toBe(true);
    if (out.success && out.result.success) expect(out.result.spacerId).toBeDefined();
  });

  it('createInput returns success when parent exists', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'root', width: 400, height: 300 }, api);
    const out = await executeTool(
      { nodeMap, api },
      'createInput',
      { parentId: 'root', label: 'Email', placeholder: 'you@example.com' }
    );
    expect(out.success).toBe(true);
    if (out.success && out.result.success) expect(out.result.inputId).toBeDefined();
  });

  it('createForm returns success when parent exists', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'root', width: 400, height: 300 }, api);
    const out = await executeTool(
      { nodeMap, api },
      'createForm',
      { parentId: 'root', fields: [{ label: 'Email' }, { label: 'Password', placeholder: '••••' }], title: 'Login' }
    );
    expect(out.success).toBe(true);
    if (out.success && out.result.success) expect(out.result.formId).toBeDefined();
  });

  it('createTable returns success when parent exists', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'root', width: 600, height: 400 }, api);
    const out = await executeTool(
      { nodeMap, api },
      'createTable',
      { parentId: 'root', columns: 3, rows: 4, headerRow: ['A', 'B', 'C'] }
    );
    expect(out.success).toBe(true);
    if (out.success && out.result.success) expect(out.result.tableId).toBeDefined();
  });

  it('createButtonRow returns success when parent exists', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'root', width: 400, height: 300 }, api);
    const out = await executeTool(
      { nodeMap, api },
      'createButtonRow',
      { parentId: 'root', buttons: [{ label: 'Weiter' }, { label: 'Abbrechen', variant: 'outline' }], direction: 'horizontal' }
    );
    expect(out.success).toBe(true);
    if (out.success && out.result.success) {
      expect(out.result.buttonRowId).toBeDefined();
      expect(out.result.buttonIds).toHaveLength(2);
    }
  });

  it('setLayout returns success when frame exists', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'sec', width: 400, height: 300, layoutMode: 'VERTICAL' }, api);
    const out = await executeTool(
      { nodeMap, api },
      'setLayout',
      { nodeId: 'sec', itemSpacing: 16 }
    );
    expect(out.success).toBe(true);
    if (out.success && out.result.success) expect(out.result).toBeDefined();
  });

  it('createCheckbox returns success when parent exists', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'root', width: 400, height: 300 }, api);
    const out = await executeTool(
      { nodeMap, api },
      'createCheckbox',
      { parentId: 'root', label: 'Agree', checked: false }
    );
    expect(out.success).toBe(true);
    if (out.success && out.result.success) expect(out.result.checkboxId).toBeDefined();
  });

  it('createRadio returns success when parent exists', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'root', width: 400, height: 300 }, api);
    const out = await executeTool(
      { nodeMap, api },
      'createRadio',
      { parentId: 'root', label: 'Option A' }
    );
    expect(out.success).toBe(true);
    if (out.success && out.result.success) expect(out.result.radioId).toBeDefined();
  });

  it('createTextarea returns success when parent exists', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'root', width: 400, height: 300 }, api);
    const out = await executeTool(
      { nodeMap, api },
      'createTextarea',
      { parentId: 'root', label: 'Message', rows: 4 }
    );
    expect(out.success).toBe(true);
    if (out.success && out.result.success) expect(out.result.textareaId).toBeDefined();
  });

  it('createList returns success when parent exists', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'root', width: 400, height: 300 }, api);
    const out = await executeTool(
      { nodeMap, api },
      'createList',
      { parentId: 'root', items: ['One', 'Two', 'Three'], variant: 'bullet' }
    );
    expect(out.success).toBe(true);
    if (out.success && out.result.success) expect(out.result.listId).toBeDefined();
  });

  it('createHeader returns success when parent exists', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'stage', width: 800, height: 600 }, api);
    const out = await executeTool(
      { nodeMap, api },
      'createHeader',
      { parentId: 'stage', logoLabel: 'Brand', navItems: ['Home', 'About'], ctaLabel: 'Login' }
    );
    expect(out.success).toBe(true);
    if (out.success && out.result.success) expect(out.result.headerId).toBeDefined();
  });

  it('createHero returns success when parent exists', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'stage', width: 600, height: 500 }, api);
    const out = await executeTool(
      { nodeMap, api },
      'createHero',
      { parentId: 'stage', title: 'Welcome', subtitle: 'Sub', ctaLabel: 'Start' }
    );
    expect(out.success).toBe(true);
    if (out.success && out.result.success) expect(out.result.heroId).toBeDefined();
  });

  it('groupNodes returns success when parent and childIds exist', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'parent', width: 200, height: 100 }, api);
    createRectangle(nodeMap, { id: 'c1', width: 40, height: 40 }, api);
    createRectangle(nodeMap, { id: 'c2', width: 40, height: 40 }, api);
    appendChild(nodeMap, 'parent', 'c1');
    appendChild(nodeMap, 'parent', 'c2');
    const out = await executeTool(
      { nodeMap, api },
      'groupNodes',
      { parentId: 'parent', childIds: ['c1', 'c2'], id: 'grp1' }
    );
    expect(out.success).toBe(true);
    if (out.success && out.result.success) expect(out.result.groupId).toBe('grp1');
  });

  it('addSvg returns success when parent exists', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'root', width: 400, height: 300 }, api);
    const out = await executeTool(
      { nodeMap, api },
      'addSvg' as any,
      { parentId: 'root', svgCode: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>', width: 24, height: 24 }
    );
    expect(out.success).toBe(true);
    if (out.success && out.result.success) expect((out.result as { svgId?: string }).svgId).toBeDefined();
  });

  it('createIconButton returns success when parent exists (label-only)', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'root', width: 400, height: 300 }, api);
    const out = await executeTool(
      { nodeMap, api },
      'createIconButton' as any,
      { parentId: 'root', label: 'Save' }
    );
    expect(out.success).toBe(true);
    if (out.success && out.result.success) expect((out.result as { buttonId?: string }).buttonId).toBeDefined();
  });

  it('returns error for unknown tool', async () => {
    const nodeMap: NodeMap = new Map();
    const out = await executeTool(
      { nodeMap },
      'unknown' as any,
      {}
    );
    expect(out.success).toBe(false);
    if (!out.success) expect(out.error).toContain('Unknown tool');
  });
});
