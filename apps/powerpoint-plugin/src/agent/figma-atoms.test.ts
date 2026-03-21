/**
 * Unit tests for Figma atoms (createFrame, createRectangle, createText, appendChild).
 * Uses mock FigmaApiLike. Run with Jest or similar if configured.
 */

import {
  createFrame,
  createRectangle,
  createEllipse,
  createLine,
  createText,
  appendChild,
  generateId,
  groupNodes,
  createSvgNode,
  type FigmaApiLike,
  type NodeMap,
} from './figma-atoms';

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
  const created: { frames: any[]; rects: any[]; ellipses: any[]; lines: any[]; texts: any[] } = {
    frames: [], rects: [], ellipses: [], lines: [], texts: [],
  };
  return {
    loadFontAsync: async (_: { family: string; style: string }) => {},
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
      Object.assign(node, { fontName: { family: 'Inter', style: 'Regular' }, characters: '', fontSize: 14, fills: [] });
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

describe('figma-atoms', () => {
  it('generateId returns unique ids with prefix', () => {
    const a = generateId('btn');
    const b = generateId('btn');
    expect(a).toMatch(/^btn_\d+$/);
    expect(b).toMatch(/^btn_\d+$/);
    expect(a).not.toBe(b);
  });

  it('createFrame stores node in nodeMap and returns id', () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    const id = createFrame(nodeMap, { id: 'root', name: 'Root', width: 100, height: 100 }, api);
    expect(id).toBe('root');
    expect(nodeMap.get('root')).toBeDefined();
    expect(nodeMap.size).toBe(1);
  });

  it('createFrame generates id when opts.id is omitted', () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    const id = createFrame(nodeMap, { name: 'F', width: 50, height: 50 }, api);
    expect(id).toMatch(/^frame_\d+$/);
    expect(nodeMap.get(id)).toBeDefined();
  });

  it('createRectangle stores node in nodeMap', () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    const id = createRectangle(nodeMap, { id: 'r1', width: 80, height: 40, cornerRadius: 8 }, api);
    expect(id).toBe('r1');
    expect(nodeMap.get('r1')).toBeDefined();
  });

  it('createText stores node in nodeMap after loadFont', async () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    const id = await createText(nodeMap, { id: 't1', characters: 'Hello', fontSize: 14 }, api);
    expect(id).toBe('t1');
    expect(nodeMap.get('t1')).toBeDefined();
  });

  it('appendChild throws when parentId not in map', () => {
    const nodeMap: NodeMap = new Map();
    expect(() => appendChild(nodeMap, 'missing', 'child')).toThrow(/parent "missing" not found/);
  });

  it('appendChild throws when childId not in map', () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'parent', width: 100, height: 100 }, api);
    expect(() => appendChild(nodeMap, 'parent', 'missing')).toThrow(/child "missing" not found/);
  });

  it('appendChild calls parent.appendChild when both in map', () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'parent', width: 100, height: 100 }, api);
    createRectangle(nodeMap, { id: 'child', width: 50, height: 50 }, api);
    appendChild(nodeMap, 'parent', 'child');
    const parent = nodeMap.get('parent') as any;
    expect(parent._children).toHaveLength(1);
    expect(parent._children[0]).toBe(nodeMap.get('child'));
  });

  it('createEllipse stores node in nodeMap', () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    const id = createEllipse(nodeMap, { id: 'e1', width: 40, height: 40 }, api);
    expect(id).toBe('e1');
    expect(nodeMap.get('e1')).toBeDefined();
  });

  it('createLine stores node in nodeMap', () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    const id = createLine(nodeMap, { id: 'l1', length: 200, strokeWeight: 1 }, api);
    expect(id).toBe('l1');
    expect(nodeMap.get('l1')).toBeDefined();
  });

  it('appendChild works with ellipse and line as children', () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'parent', width: 100, height: 100 }, api);
    createEllipse(nodeMap, { id: 'e1', width: 20, height: 20 }, api);
    createLine(nodeMap, { id: 'l1', length: 50 }, api);
    appendChild(nodeMap, 'parent', 'e1');
    appendChild(nodeMap, 'parent', 'l1');
    const parent = nodeMap.get('parent') as any;
    expect(parent._children).toHaveLength(2);
  });

  it('groupNodes returns error when parentId not in nodeMap', () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    const result = groupNodes(nodeMap, 'missing', ['a', 'b'], undefined, api);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('parent "missing"');
  });

  it('groupNodes returns error when childIds empty', () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'parent', width: 100, height: 100 }, api);
    const result = groupNodes(nodeMap, 'parent', [], undefined, api);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('childIds');
  });

  it('groupNodes creates group and returns groupId when parent and children exist', () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    createFrame(nodeMap, { id: 'parent', width: 200, height: 100 }, api);
    createRectangle(nodeMap, { id: 'a', width: 40, height: 40 }, api);
    createRectangle(nodeMap, { id: 'b', width: 40, height: 40 }, api);
    appendChild(nodeMap, 'parent', 'a');
    appendChild(nodeMap, 'parent', 'b');
    const result = groupNodes(nodeMap, 'parent', ['a', 'b'], 'myGroup', api);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.groupId).toBe('myGroup');
      expect(nodeMap.get('myGroup')).toBeDefined();
    }
  });

  it('createSvgNode returns error when svgCode empty', () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    const result = createSvgNode(nodeMap, '', undefined, api);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('svgCode');
  });

  it('createSvgNode stores node and returns nodeId when api has createNodeFromSvg', () => {
    const nodeMap: NodeMap = new Map();
    const api = createMockApi();
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 18h18v-2H3v2z"/></svg>';
    const result = createSvgNode(nodeMap, svg, 'myIcon', api);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.nodeId).toBe('myIcon');
      expect(nodeMap.get('myIcon')).toBeDefined();
    }
  });
});
