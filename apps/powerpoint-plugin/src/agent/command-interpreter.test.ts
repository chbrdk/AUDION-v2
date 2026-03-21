/**
 * Unit tests for the command interpreter using a mock Figma API.
 * Run with: npx jest src/agent/command-interpreter.test.ts (if Jest is configured)
 * or: node --experimental-vm-modules node_modules/jest/bin/jest.js (if available).
 *
 * These tests verify that the interpreter correctly dispatches commands to the API
 * and returns errors with failedCommand for self-correction.
 */

import { runCommands, type FigmaApiLike } from './command-interpreter';
import type { FigmaCommand } from './figma-command-schema';

function createMockNode(id: string) {
  const children: unknown[] = [];
  return {
    id,
    _children: children,
    appendChild(child: unknown) {
      children.push(child);
    },
    resize(_w: number, _h: number) {},
    get name() { return (this as any)._name; },
    set name(v: string) { (this as any)._name = v; },
  };
}

describe('command-interpreter', () => {
  let mockNodes: Map<string, ReturnType<typeof createMockNode>>;
  let loadFontCalls: Array<{ family: string; style: string }>;
  let createdFrames: unknown[];
  let createdTexts: unknown[];
  let contextChildren: unknown[];

  const createMockApi = (): FigmaApiLike => {
    loadFontCalls = [];
    createdFrames = [];
    createdTexts = [];
    contextChildren = [];
    mockNodes = new Map();

    const context = {
      appendChild(child: unknown) {
        contextChildren.push(child);
      },
    };

    return {
      loadFontAsync: async (fontName: { family: string; style: string }) => {
        loadFontCalls.push(fontName);
      },
      createFrame: () => {
        const id = `frame_${createdFrames.length}`;
        const node = createMockNode(id) as unknown as FrameNode;
        (node as any).layoutMode = 'NONE';
        (node as any).primaryAxisSizingMode = 'FIXED';
        (node as any).counterAxisSizingMode = 'FIXED';
        (node as any).itemSpacing = 0;
        (node as any).paddingTop = 0;
        (node as any).paddingBottom = 0;
        (node as any).paddingLeft = 0;
        (node as any).paddingRight = 0;
        (node as any).fills = [];
        (node as any).strokes = [];
        (node as any).strokeWeight = 0;
        (node as any).cornerRadius = 0;
        (node as any).opacity = 1;
        (node as any).x = 0;
        (node as any).y = 0;
        createdFrames.push(node);
        mockNodes.set(id, node as any);
        return node as unknown as FrameNode;
      },
      createRectangle: () => createMockNode('rect') as unknown as RectangleNode,
      createEllipse: () => createMockNode('ellipse') as unknown as EllipseNode,
      createLine: () => createMockNode('line') as unknown as LineNode,
      createText: () => {
        const id = `text_${createdTexts.length}`;
        const node = createMockNode(id) as unknown as TextNode;
        (node as any).fontName = { family: 'Inter', style: 'Regular' };
        (node as any).characters = '';
        (node as any).fontSize = 14;
        (node as any).fills = [];
        createdTexts.push(node);
        mockNodes.set(id, node as any);
        return node as unknown as TextNode;
      },
      group: (nodes: ReadonlyArray<SceneNode>, _parent: BaseNode & ChildrenMixin, _index?: number) => {
        const g = createMockNode('group') as unknown as GroupNode;
        nodes.forEach((n) => (g as any)._children.push(n));
        return g as unknown as GroupNode;
      },
    };
  };

  it('runs loadFont + createFrame + createText + appendChild and attaches root to context', async () => {
    const api = createMockApi();
    const commands: FigmaCommand[] = [
      { op: 'loadFont', family: 'Inter', style: 'Bold' },
      {
        op: 'createFrame',
        id: 'root',
        name: 'Header',
        width: 360,
        height: 56,
        layoutMode: 'HORIZONTAL',
        paddingLeft: 16,
        paddingRight: 16,
        fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
      },
      {
        op: 'createText',
        id: 't1',
        characters: 'Title',
        fontSize: 18,
        fontFamily: 'Inter',
        fontStyle: 'Bold',
        fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }],
      },
      { op: 'appendChild', parentId: 'root', childId: 't1' },
    ];
    const context = { appendChild: (c: unknown) => contextChildren.push(c) };

    const result = await runCommands(commands, 'root', context as unknown as BaseNode & ChildrenMixin, api);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.nodes).toHaveLength(1);
      expect(contextChildren).toHaveLength(1);
    }
    expect(loadFontCalls).toContainEqual({ family: 'Inter', style: 'Bold' });
    expect(createdFrames.length).toBe(1);
    expect(createdTexts.length).toBe(1);
  });

  it('returns error with failedCommand when appendChild references unknown parent', async () => {
    const api = createMockApi();
    const commands: FigmaCommand[] = [
      { op: 'createFrame', id: 'root', width: 100, height: 100 },
      { op: 'appendChild', parentId: 'nonexistent', childId: 'root' },
    ];
    const context = { appendChild: () => {} };

    const result = await runCommands(commands, 'root', context as unknown as BaseNode & ChildrenMixin, api);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('parent');
      expect(result.failedCommand).toEqual({ op: 'appendChild', parentId: 'nonexistent', childId: 'root' });
      expect(result.failedCommandIndex).toBe(1);
    }
  });

  it('returns error when rootId is not in node map', async () => {
    const api = createMockApi();
    const commands: FigmaCommand[] = [];
    const result = await runCommands(commands, 'root', null, api);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('rootId');
    }
  });
});
