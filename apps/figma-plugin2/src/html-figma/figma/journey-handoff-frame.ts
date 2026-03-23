/**
 * Places a vertical auto-layout frame beside the imported wireframe with journey handoff copy
 * (concept rationale + Figma Make prompt). Text is chunked to stay within Figma text limits.
 */
import { defaultFont } from './getFont';

const GAP_X = 48;
const PANEL_WIDTH = 440;
const INNER_W = PANEL_WIDTH - 40;
/** Stay under typical Figma text node limits. */
const MAX_CHARS = 7500;

const FONT_BOLD: FontName = { family: 'Roboto', style: 'Bold' };

function chunkString(s: string): string[] {
  const t = s.trim();
  if (!t.length) return [''];
  if (t.length <= MAX_CHARS) return [t];
  const out: string[] = [];
  let i = 0;
  while (i < t.length) {
    let end = Math.min(i + MAX_CHARS, t.length);
    if (end < t.length) {
      const br = t.lastIndexOf('\n\n', end);
      if (br > i + 400) end = br;
    }
    const slice = t.slice(i, end).trim();
    if (slice.length) out.push(slice);
    i = end;
  }
  return out.length ? out : [t.slice(0, MAX_CHARS)];
}

async function appendHeading(parent: FrameNode, text: string): Promise<void> {
  await figma.loadFontAsync(FONT_BOLD);
  const node = figma.createText();
  node.fontName = FONT_BOLD;
  node.fontSize = 13;
  node.textAutoResize = 'HEIGHT';
  node.resize(INNER_W, 24);
  node.characters = text;
  parent.appendChild(node);
}

async function appendBodyChunks(parent: FrameNode, body: string): Promise<void> {
  await figma.loadFontAsync(defaultFont);
  for (const chunk of chunkString(body)) {
    const node = figma.createText();
    node.fontName = defaultFont;
    node.fontSize = 11;
    node.textAutoResize = 'HEIGHT';
    node.resize(INNER_W, 4000);
    node.characters = chunk;
    parent.appendChild(node);
  }
}

export type JourneyHandoffPackPayload = {
  conceptDocument: string;
  figmaMakePrompt: string;
};

/**
 * Creates a sibling frame to the right of `wireframeRoot` on the same parent (usually the page).
 */
export async function createJourneyHandoffFrameBesideWireframe(
  wireframeRoot: SceneNode,
  pack: JourneyHandoffPackPayload
): Promise<FrameNode | null> {
  const parent = wireframeRoot.parent;
  if (!parent) return null;

  const lm = wireframeRoot as LayoutMixin;
  const ab =
    'absoluteBoundingBox' in wireframeRoot && wireframeRoot.absoluteBoundingBox
      ? wireframeRoot.absoluteBoundingBox
      : null;
  const wx = ab?.x ?? lm.x;
  const wy = ab?.y ?? lm.y;
  const ww = ab?.width ?? lm.width;

  const frame = figma.createFrame();
  frame.name = 'MSQDX · Konzept & Figma Make';
  frame.layoutMode = 'VERTICAL';
  frame.primaryAxisSizingMode = 'AUTO';
  frame.counterAxisSizingMode = 'FIXED';
  frame.resize(PANEL_WIDTH, 200);
  frame.paddingLeft = 20;
  frame.paddingRight = 20;
  frame.paddingTop = 20;
  frame.paddingBottom = 20;
  frame.itemSpacing = 10;
  frame.fills = [{ type: 'SOLID', color: { r: 0.98, g: 0.98, b: 0.99 } }];
  frame.strokes = [{ type: 'SOLID', color: { r: 0.86, g: 0.87, b: 0.9 } }];
  frame.strokeWeight = 1;
  frame.cornerRadius = 8;

  parent.appendChild(frame);
  frame.x = wx + ww + GAP_X;
  frame.y = wy;

  await appendHeading(frame, 'Concept & rationale');
  await appendBodyChunks(frame, pack.conceptDocument);
  await appendHeading(frame, 'Figma Make — prompt');
  await appendBodyChunks(frame, pack.figmaMakePrompt);

  return frame;
}
