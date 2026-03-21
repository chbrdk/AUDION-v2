/**
 * Command Interpreter – Executes whitelisted Figma commands only (no generated code).
 * Uses only the official Figma Plugin API. On error, returns a message for the Figma Executor to self-correct.
 *
 * @deprecated Not used by generate-wireframe anymore; the plugin uses only the Wireframe Tool Agent (executeTool loop).
 * Kept for reference or potential future use (e.g. export/replay). Tests in command-interpreter.test.ts still validate this module.
 */
import type {
  FigmaCommand,
  LoadFontCommand,
  CreateFrameCommand,
  CreateRectangleCommand,
  CreateEllipseCommand,
  CreateLineCommand,
  CreateTextCommand,
  AppendChildCommand,
  GroupCommand,
  SolidFill,
} from './figma-command-schema';

export interface InterpreterResult {
  success: true;
  nodes: SceneNode[];
}

export interface InterpreterError {
  success: false;
  error: string;
  failedCommand?: FigmaCommand;
  failedCommandIndex?: number;
}

export type RunCommandsResult = InterpreterResult | InterpreterError;

/** Minimal Figma API surface used by the interpreter (for dependency injection in tests). */
export interface FigmaApiLike {
  loadFontAsync: (fontName: { family: string; style: string }) => Promise<void>;
  createFrame: () => FrameNode;
  createRectangle: () => RectangleNode;
  createEllipse: () => EllipseNode;
  createLine: () => LineNode;
  createText: () => TextNode;
  group: (nodes: ReadonlyArray<SceneNode>, parent: BaseNode & ChildrenMixin, index?: number) => GroupNode;
}

function applyFills(node: FrameNode | RectangleNode | EllipseNode | LineNode | TextNode, fills?: SolidFill[]) {
  if (!fills || fills.length === 0) return;
  node.fills = fills.map((f) => ({
    type: 'SOLID' as const,
    color: f.color,
    opacity: f.opacity ?? 1,
  }));
}

function applyStrokes(node: FrameNode | RectangleNode | EllipseNode | LineNode, strokes?: SolidFill[], strokeWeight?: number | null) {
  if (strokes && strokes.length > 0) {
    node.strokes = strokes.map((f) => ({
      type: 'SOLID' as const,
      color: f.color,
      opacity: f.opacity ?? 1,
    }));
  }
  if (strokeWeight != null && typeof strokeWeight === 'number') node.strokeWeight = strokeWeight;
}

/**
 * Runs a list of Figma commands and attaches the root node to contextNode.
 * Uses global `figma` when figmaApi is not provided (plugin environment).
 */
export async function runCommands(
  commands: FigmaCommand[],
  rootId: string,
  contextNode: (BaseNode & ChildrenMixin) | null,
  figmaApi?: FigmaApiLike
): Promise<RunCommandsResult> {
  const api = figmaApi ?? (typeof figma !== 'undefined' ? (figma as unknown as FigmaApiLike) : null);
  if (!api) {
    return { success: false, error: 'No Figma API available' };
  }

  if (typeof console !== 'undefined' && console.log) {
    console.log('[Wireframe] runCommands start', { commands: commands.length, rootId });
  }

  const nodeMap = new Map<string, SceneNode>();
  let lastStoredId: string | null = null;

  /** Resolve id for nodeMap; schema allows null so we fallback to avoid storing under null. */
  const store = (key: string, node: SceneNode) => {
    nodeMap.set(key, node);
    lastStoredId = key;
  };
  const id = (c: { id?: string | null }, i: number) => (c.id != null && c.id !== '' ? c.id : `_n${i}`);

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    try {
      switch (cmd.op) {
        case 'loadFont': {
          const c = cmd as LoadFontCommand;
          await api.loadFontAsync({ family: c.family, style: c.style });
          break;
        }
        case 'createFrame': {
          const c = cmd as CreateFrameCommand;
          const frame = api.createFrame();
          if (c.name) frame.name = c.name;
          frame.resize(Number(c.width) || 100, Number(c.height) || 100);
          if (c.layoutMode === 'HORIZONTAL' || c.layoutMode === 'VERTICAL' || c.layoutMode === 'NONE') frame.layoutMode = c.layoutMode;
          // Figma rejects null for these enums; only set when value is valid
          if (c.primaryAxisSizingMode === 'FIXED' || c.primaryAxisSizingMode === 'AUTO') frame.primaryAxisSizingMode = c.primaryAxisSizingMode;
          if (c.counterAxisSizingMode === 'FIXED' || c.counterAxisSizingMode === 'AUTO') frame.counterAxisSizingMode = c.counterAxisSizingMode;
          const primaryAlign = c.primaryAxisAlignItems;
          if (primaryAlign === 'MIN' || primaryAlign === 'MAX' || primaryAlign === 'CENTER' || primaryAlign === 'SPACE_BETWEEN') frame.primaryAxisAlignItems = primaryAlign;
          const counterAlign = c.counterAxisAlignItems;
          if (counterAlign === 'MIN' || counterAlign === 'MAX' || counterAlign === 'CENTER' || counterAlign === 'BASELINE') frame.counterAxisAlignItems = counterAlign;
          if (c.itemSpacing != null && typeof c.itemSpacing === 'number') frame.itemSpacing = c.itemSpacing;
          if (c.paddingTop != null && typeof c.paddingTop === 'number') frame.paddingTop = c.paddingTop;
          if (c.paddingBottom != null && typeof c.paddingBottom === 'number') frame.paddingBottom = c.paddingBottom;
          if (c.paddingLeft != null && typeof c.paddingLeft === 'number') frame.paddingLeft = c.paddingLeft;
          if (c.paddingRight != null && typeof c.paddingRight === 'number') frame.paddingRight = c.paddingRight;
          applyFills(frame, c.fills);
          applyStrokes(frame, c.strokes, c.strokeWeight);
          if (c.cornerRadius != null && typeof c.cornerRadius === 'number') frame.cornerRadius = c.cornerRadius;
          if (typeof c.clipsContent === 'boolean') frame.clipsContent = c.clipsContent;
          if (c.opacity != null && typeof c.opacity === 'number') frame.opacity = c.opacity;
          if (c.x != null && typeof c.x === 'number') frame.x = c.x;
          if (c.y != null && typeof c.y === 'number') frame.y = c.y;
          store(id(c, i), frame);
          break;
        }
        case 'createRectangle': {
          const c = cmd as CreateRectangleCommand;
          const rect = api.createRectangle();
          if (c.name) rect.name = c.name;
          rect.resize(Number(c.width) || 100, Number(c.height) || 100);
          applyFills(rect, c.fills);
          applyStrokes(rect, c.strokes, c.strokeWeight);
          if (c.cornerRadius != null && typeof c.cornerRadius === 'number') rect.cornerRadius = c.cornerRadius;
          if (c.opacity != null && typeof c.opacity === 'number') rect.opacity = c.opacity;
          if (c.x != null && typeof c.x === 'number') rect.x = c.x;
          if (c.y != null && typeof c.y === 'number') rect.y = c.y;
          store(id(c, i), rect);
          break;
        }
        case 'createEllipse': {
          const c = cmd as CreateEllipseCommand;
          const ellipse = api.createEllipse();
          if (c.name) ellipse.name = c.name;
          ellipse.resize(Number(c.width) || 100, Number(c.height) || 100);
          applyFills(ellipse, c.fills);
          applyStrokes(ellipse, c.strokes, c.strokeWeight);
          if (c.opacity != null && typeof c.opacity === 'number') ellipse.opacity = c.opacity;
          if (c.x != null && typeof c.x === 'number') ellipse.x = c.x;
          if (c.y != null && typeof c.y === 'number') ellipse.y = c.y;
          store(id(c, i), ellipse);
          break;
        }
        case 'createLine': {
          const c = cmd as CreateLineCommand;
          const line = api.createLine();
          if (c.name) line.name = c.name;
          const w = c.x2 != null && c.x1 != null ? Math.abs(c.x2 - c.x1) : 100;
          line.resize(w, 0);
          if (c.x1 != null && typeof c.x1 === 'number') line.x = c.x1;
          if (c.y1 != null && typeof c.y1 === 'number') line.y = c.y1;
          applyStrokes(line, c.strokes, c.strokeWeight);
          store(id(c, i), line);
          break;
        }
        case 'createText': {
          const c = cmd as CreateTextCommand;
          await api.loadFontAsync({ family: c.fontFamily, style: c.fontStyle });
          const text = api.createText();
          if (c.name) text.name = c.name;
          text.fontName = { family: c.fontFamily, style: c.fontStyle };
          text.characters = c.characters ?? '';
          if (c.fontSize != null && typeof c.fontSize === 'number') text.fontSize = c.fontSize;
          if (c.fills && c.fills.length > 0) {
            text.fills = c.fills.map((f) => ({
              type: 'SOLID' as const,
              color: f.color,
              opacity: f.opacity ?? 1,
            }));
          }
          const alignH = c.textAlignHorizontal;
          if (alignH === 'LEFT' || alignH === 'CENTER' || alignH === 'RIGHT' || alignH === 'JUSTIFIED') text.textAlignHorizontal = alignH;
          const autoResize = c.textAutoResize;
          if (autoResize === 'NONE' || autoResize === 'HEIGHT' || autoResize === 'WIDTH_AND_HEIGHT') text.textAutoResize = autoResize;
          if (c.opacity != null && typeof c.opacity === 'number') text.opacity = c.opacity;
          if (c.x != null && typeof c.x === 'number') text.x = c.x;
          if (c.y != null && typeof c.y === 'number') text.y = c.y;
          store(id(c, i), text);
          break;
        }
        case 'appendChild': {
          const c = cmd as AppendChildCommand;
          const parent = nodeMap.get(c.parentId);
          const child = nodeMap.get(c.childId);
          if (!parent || !('appendChild' in parent)) {
            throw new Error(`appendChild: parent "${c.parentId}" not found or not a container`);
          }
          if (!child) {
            throw new Error(`appendChild: child "${c.childId}" not found`);
          }
          (parent as BaseNode & ChildrenMixin).appendChild(child);
          break;
        }
        case 'group': {
          const c = cmd as GroupCommand;
          const parent = nodeMap.get(c.parentId);
          if (!parent || !('appendChild' in parent)) {
            throw new Error(`group: parent "${c.parentId}" not found or not a container`);
          }
          const children = c.childIds.map((id) => nodeMap.get(id)).filter((n): n is SceneNode => n != null);
          if (children.length !== c.childIds.length) {
            throw new Error(`group: some childIds not found`);
          }
          const group = api.group(children, parent as BaseNode & ChildrenMixin, c.index);
          if (c.name) group.name = c.name;
          store(id(c, i), group);
          break;
        }
        default: {
          const _: never = cmd;
          throw new Error(`Unknown command op: ${(cmd as FigmaCommand).op}`);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (typeof console !== 'undefined' && console.error) {
        console.error('[Wireframe] runCommands failed at index', i, 'op:', (cmd as FigmaCommand).op, 'error:', message);
      }
      return {
        success: false,
        error: message,
        failedCommand: cmd,
        failedCommandIndex: i,
      };
    }
  }

  let rootNode: SceneNode | undefined = nodeMap.get(rootId ?? '');
  if (!rootNode && lastStoredId) {
    rootNode = nodeMap.get(lastStoredId);
  }
  if (!rootNode) {
    return {
      success: false,
      error: `rootId "${rootId}" not found in created nodes`,
      failedCommandIndex: commands.length,
    };
  }

  if (contextNode && 'appendChild' in contextNode) {
    (contextNode as BaseNode & ChildrenMixin).appendChild(rootNode);
  }

  if (typeof console !== 'undefined' && console.log) {
    console.log('[Wireframe] runCommands success', { rootId, nodeMapSize: nodeMap.size });
  }
  return { success: true, nodes: [rootNode] };
}
