/**
 * Composition renderer: renders figRAG Composition JSON to Figma.
 * Supports instance, raw_text, spacer, group, grid, frame nodes.
 */

import type {
  CompositionJSON,
  CompositionSection,
  CompositionChild,
  RawTextNode,
  SpacerNode,
  GroupNode,
  GridNode,
} from '../api/rag-compose-client';

type ComposeInstanceNode = import('../api/rag-compose-client').InstanceNode;
type ComposeFrameNode = import('../api/rag-compose-client').FrameNode;

/** Figma node that can have children (FrameNode, etc.) */
type ParentNode = FrameNode;

function normalizePadding(p: number | [number, number] | [number, number, number, number]): [number, number, number, number] {
  if (typeof p === 'number') return [p, p, p, p];
  if (p.length === 2) return [p[0], p[1], p[0], p[1]];
  return p;
}

async function ensureFont(family: string, style: string): Promise<FontName> {
  try {
    await figma.loadFontAsync({ family, style });
    return { family, style };
  } catch {
    try {
      await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
      return { family: 'Inter', style: 'Regular' };
    } catch {
      await figma.loadFontAsync({ family: 'Roboto', style: 'Regular' });
      return { family: 'Roboto', style: 'Regular' };
    }
  }
}

function mapFontWeight(fw?: string): string {
  switch (fw) {
    case 'bold': return 'Bold';
    case 'semibold': return 'Semi Bold';
    case 'medium': return 'Medium';
    default: return 'Regular';
  }
}

function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16) / 255,
    g: parseInt(clean.slice(2, 4), 16) / 255,
    b: parseInt(clean.slice(4, 6), 16) / 255,
  };
}

/** Synonym groups for text layer matching (content/body/headline/label/placeholder). */
const LAYER_SYNONYM_GROUPS: Record<string, string[]> = {
  headline: ['headline', 'heading', 'title', 'head', 'h1', 'h2', 'h3', 'überschrift', 'titel'],
  body: ['body', 'content', 'text', 'paragraph', 'description', 'copy', 'fließtext', 'beschreibung', 'inhalt'],
  label: ['label', 'caption', 'button', 'cta', 'action', 'beschriftung'],
  placeholder: ['placeholder', 'hint', 'default', 'example', 'hilfetext'],
};

function normalizeForKey(s: string): string {
  return s.toLowerCase().replace(/[\s_-]/g, '');
}

function inSynonymGroup(term: string, synonyms: string[]): boolean {
  return synonyms.some((s) => term === s || term.includes(s) || s.includes(term));
}

/** Match layer name: exact, contains, or synonym-group match (case-insensitive). */
function layerNameMatches(nodeName: string, key: string): boolean {
  const n = normalizeForKey(nodeName);
  const k = normalizeForKey(key);
  if (n === k || n.includes(k) || k.includes(n)) return true;
  for (const synonyms of Object.values(LAYER_SYNONYM_GROUPS)) {
    if (inSynonymGroup(n, synonyms) && inSynonymGroup(k, synonyms)) return true;
  }
  return false;
}

/** Set text layers: textOverrides by layer name, else label → first text. */
async function applyTextOverrides(
  instance: InstanceNode,
  label?: string,
  textOverrides?: Record<string, string>
): Promise<void> {
  try {
    const textNodes = instance.findAllWithCriteria?.({ types: ['TEXT'] }) ?? [];
    if (textNodes.length === 0) return;

    const modified = new Set<SceneNode>();

    // textOverrides: match by layer name (Headline, Body, Label, etc.)
    if (textOverrides && typeof textOverrides === 'object') {
      for (const [layerKey, content] of Object.entries(textOverrides)) {
        if (!content || typeof content !== 'string') continue;
        const match = textNodes.find((t) => layerNameMatches(t.name, layerKey));
        if (match) {
          await figma.loadFontAsync(match.fontName as FontName);
          match.characters = content;
          modified.add(match);
        }
      }
    }

    // label: set first text layer if not already modified (for single-text components like Button)
    if (label && typeof label === 'string' && !modified.has(textNodes[0])) {
      const first = textNodes[0];
      if (first) {
        await figma.loadFontAsync(first.fontName as FontName);
        first.characters = label;
      }
    }
  } catch {
    // Ignore – component may not allow text override
  }
}

async function renderChild(
  child: CompositionChild,
  parent: ParentNode,
  resolvedKeys: Record<string, string>,
  parentWidth: number,
  resolvedTypes?: Record<string, 'component' | 'component_set'>
): Promise<SceneNode | null> {
  switch (child.type) {
    case 'raw_text': {
      const n = child as RawTextNode;
      const style = mapFontWeight(n.fontWeight);
      const font = await ensureFont('Inter', style);
      const text = figma.createText();
      text.fontName = font;
      text.characters = n.content;
      text.fontSize = n.fontSize ?? 16;
      text.lineHeight = { value: 120, unit: 'PERCENT' };
      text.textAutoResize = n.maxWidth ? 'HEIGHT' : 'WIDTH_AND_HEIGHT';
      if (n.color) text.fills = [{ type: 'SOLID', color: hexToRgb(n.color), opacity: 1 }];
      if (n.align === 'center') text.textAlignHorizontal = 'CENTER';
      else if (n.align === 'right') text.textAlignHorizontal = 'RIGHT';
      if (n.maxWidth) text.resize(n.maxWidth, 1000);
      parent.appendChild(text);
      return text;
    }
    case 'spacer': {
      const n = child as SpacerNode;
      const h = n.height ?? 24;
      const frame = figma.createFrame();
      frame.resize(parentWidth, h);
      frame.fills = [];
      frame.name = 'Spacer';
      parent.appendChild(frame);
      return frame;
    }
    case 'instance': {
      const n = child as ComposeInstanceNode;
      const key = resolvedKeys[n.component];
      if (!key) {
        const placeholder = figma.createFrame();
        placeholder.name = `[${n.component}]`;
        placeholder.resize(120, 40);
        placeholder.fills = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.92 }, opacity: 1 }];
        const label = figma.createText();
        const labelFont = await ensureFont('Inter', 'Regular');
        label.fontName = labelFont;
        label.characters = n.component;
        label.fontSize = 11;
        label.fills = [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.55 }, opacity: 1 }];
        placeholder.appendChild(label);
        parent.appendChild(placeholder);
        return placeholder;
      }
      try {
        const compType = resolvedTypes?.[n.component];
        const component =
          compType === 'component_set'
            ? (await figma.importComponentSetByKeyAsync(key)).defaultVariant
            : await figma.importComponentByKeyAsync(key);
        const instance = component.createInstance();
        if (n.properties && 'setProperties' in instance) {
          (instance as InstanceNode).setProperties(n.properties as Record<string, string | boolean>);
        }
        parent.appendChild(instance);
        await applyTextOverrides(instance as InstanceNode, n.label, n.textOverrides);
        return instance;
      } catch {
        try {
          const component =
            resolvedTypes?.[n.component] === 'component'
              ? await figma.importComponentByKeyAsync(key)
              : (await figma.importComponentSetByKeyAsync(key)).defaultVariant;
          const instance = component.createInstance();
          if (n.properties && 'setProperties' in instance) {
            (instance as InstanceNode).setProperties(n.properties as Record<string, string | boolean>);
          }
          parent.appendChild(instance);
          await applyTextOverrides(instance as InstanceNode, n.label, n.textOverrides);
          return instance;
        } catch {
          const placeholder = figma.createFrame();
          placeholder.name = `[${n.component} - import failed]`;
          placeholder.resize(120, 40);
          placeholder.fills = [{ type: 'SOLID', color: { r: 1, g: 0.9, b: 0.9 }, opacity: 1 }];
          const label = figma.createText();
          const labelFont = await ensureFont('Inter', 'Regular');
          label.fontName = labelFont;
          label.characters = n.component;
          label.fontSize = 11;
          label.fills = [{ type: 'SOLID', color: { r: 0.6, g: 0.3, b: 0.3 }, opacity: 1 }];
          placeholder.appendChild(label);
          parent.appendChild(placeholder);
          return placeholder;
        }
      }
    }
    case 'group': {
      const n = child as GroupNode;
      const frame = figma.createFrame();
      frame.name = n.name ?? 'Group';
      frame.layoutMode = n.layout === 'horizontal' ? 'HORIZONTAL' : 'VERTICAL';
      frame.primaryAxisSizingMode = 'AUTO';
      frame.counterAxisSizingMode = 'AUTO';
      frame.itemSpacing = n.gap ?? 0;
      frame.fills = [];
      if (n.align === 'center') frame.counterAxisAlignItems = 'CENTER';
      else if (n.align === 'end') frame.counterAxisAlignItems = 'MAX';
      if (n.justify === 'center') frame.primaryAxisAlignItems = 'CENTER';
      else if (n.justify === 'space-between') frame.primaryAxisAlignItems = 'SPACE_BETWEEN';
      const childWidth = parentWidth;
      for (const c of n.children) {
        await renderChild(c, frame, resolvedKeys, childWidth, resolvedTypes);
      }
      frame.resize(Math.max(1, frame.width), Math.max(1, frame.height));
      parent.appendChild(frame);
      return frame;
    }
    case 'grid': {
      const n = child as GridNode;
      const frame = figma.createFrame();
      frame.name = 'Grid';
      frame.layoutMode = 'HORIZONTAL';
      frame.layoutWrap = 'WRAP';
      frame.primaryAxisSizingMode = 'FIXED';
      frame.counterAxisSizingMode = 'AUTO';
      frame.itemSpacing = n.gap ?? 24;
      frame.fills = [];
      const gap = n.gap ?? 24;
      let cols = Math.min(6, Math.max(1, n.columns));
      if (n.minColumnWidth && n.minColumnWidth > 0) {
        const maxColsByMin = Math.floor((parentWidth + gap) / (n.minColumnWidth + gap));
        cols = Math.min(cols, Math.max(1, maxColsByMin));
      }
      const childWidth = (parentWidth - gap * (cols - 1)) / cols;
      for (const c of n.children) {
        await renderChild(c, frame, resolvedKeys, childWidth, resolvedTypes);
      }
      frame.resize(parentWidth, Math.max(1, frame.height));
      parent.appendChild(frame);
      return frame;
    }
    case 'frame': {
      const n = child as ComposeFrameNode;
      const frame = figma.createFrame();
      frame.name = n.name ?? 'Frame';
      frame.layoutMode = 'VERTICAL';
      frame.primaryAxisSizingMode = 'AUTO';
      frame.counterAxisSizingMode = 'FIXED';
      const w = n.width ?? parentWidth;
      frame.fills = n.fill ? [{ type: 'SOLID', color: hexToRgb(n.fill), opacity: 1 }] : [];
      if (n.cornerRadius) frame.cornerRadius = n.cornerRadius;
      if (n.children?.length) {
        for (const c of n.children) {
          await renderChild(c, frame, resolvedKeys, w, resolvedTypes);
        }
      }
      const h = n.height ?? frame.height;
      frame.resize(w, Math.max(1, h));
      parent.appendChild(frame);
      return frame;
    }
    default:
      return null;
  }
}

export async function renderComposition(
  composition: CompositionJSON,
  resolvedKeys: Record<string, string>,
  resolvedTypes?: Record<string, 'component' | 'component_set'>
): Promise<FrameNode> {
  const width = composition.width ?? 1440;
  const root = figma.createFrame();
  root.name = `${composition.page ?? 'Composed Design'} [${Date.now()}]`;
  root.layoutMode = 'VERTICAL';
  root.primaryAxisSizingMode = 'AUTO';
  root.counterAxisSizingMode = 'FIXED';
  root.itemSpacing = composition.sectionGap ?? 64;
  root.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 1 }];

  for (const section of composition.sections) {
    const sectionFrame = figma.createFrame();
    sectionFrame.name = section.type
      ? `${section.name ?? 'Section'} [${section.type}]`
      : (section.name ?? 'Section');
    sectionFrame.layoutMode = (section.layout ?? 'vertical') === 'horizontal' ? 'HORIZONTAL' : 'VERTICAL';
    sectionFrame.primaryAxisSizingMode = 'AUTO';
    sectionFrame.counterAxisSizingMode = 'FIXED';
    const sectionWidth = Math.min(section.maxWidth ?? width, width);
    sectionFrame.itemSpacing = section.gap ?? 48;
    sectionFrame.fills = section.fill ? [{ type: 'SOLID', color: hexToRgb(section.fill), opacity: 1 }] : [];

    const [pt, pr, pb, pl] = normalizePadding(section.padding ?? [80, 24]);
    sectionFrame.paddingTop = pt;
    sectionFrame.paddingRight = pr;
    sectionFrame.paddingBottom = pb;
    sectionFrame.paddingLeft = pl;

    if (section.align === 'center') sectionFrame.counterAxisAlignItems = 'CENTER';
    else if (section.align === 'end') sectionFrame.counterAxisAlignItems = 'MAX';
    if (section.justify === 'center') sectionFrame.primaryAxisAlignItems = 'CENTER';
    else if (section.justify === 'end') sectionFrame.primaryAxisAlignItems = 'MAX';
    else if (section.justify === 'space-between') sectionFrame.primaryAxisAlignItems = 'SPACE_BETWEEN';

    for (const child of section.children) {
      await renderChild(child, sectionFrame, resolvedKeys, sectionWidth - pl - pr, resolvedTypes);
    }

    sectionFrame.resize(sectionWidth, Math.max(1, sectionFrame.height));
    root.appendChild(sectionFrame);
  }

  root.resize(width, Math.max(1, root.height));
  const viewport = figma.viewport.center;
  root.x = viewport.x - root.width / 2;
  root.y = viewport.y - root.height / 2;
  figma.currentPage.appendChild(root);
  figma.viewport.scrollAndZoomIntoView([root]);

  return root;
}
