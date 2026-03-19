/**
 * DSL parser: strip markdown fences, JSON.parse, normalize keyed format, validate.
 * Supports both canonical format ({ "type": "section", ... }) and keyed format ({ "section": { ... } }).
 */

import type { DSLRoot, DSLNode } from './types';

const KNOWN_NODE_KEYS = new Set([
  'frame', 'section', 'text', 'button', 'image', 'icon', 'card', 'grid', 'stack',
  'divider', 'input', 'navbar', 'hero', 'footer', 'badge', 'avatar', 'spacer',
]);

function isKeyedNode(obj: Record<string, unknown>): boolean {
  if (obj.type != null && typeof obj.type === 'string') return false;
  const keys = Object.keys(obj).filter((k) => k !== 'type');
  if (keys.length !== 1) return false;
  return KNOWN_NODE_KEYS.has(keys[0]);
}

function normalizeNode(node: unknown): DSLNode | null {
  if (node == null || typeof node !== 'object') return null;
  const obj = node as Record<string, unknown>;

  if (isKeyedNode(obj)) {
    const key = Object.keys(obj).find((k) => KNOWN_NODE_KEYS.has(k))!;
    const value = obj[key];
    if (value == null || typeof value !== 'object') return null;
    const props = value as Record<string, unknown>;
    const normalized: Record<string, unknown> = { type: key, ...props };
    if (Array.isArray(normalized.children)) {
      normalized.children = normalized.children
        .map(normalizeNode)
        .filter((n): n is DSLNode => n != null);
    }
    if (key === 'hero') {
      const cta = (normalized.cta as Record<string, unknown> | string) ?? undefined;
      if (cta != null && typeof cta === 'object' && typeof (cta as Record<string, unknown>).label === 'string') {
        normalized.cta = (cta as Record<string, unknown>).label as string;
      }
      const img = (normalized.image as Record<string, unknown> | string) ?? undefined;
      if (img != null && typeof img === 'object' && typeof (img as Record<string, unknown>).src === 'string') {
        normalized.image = (img as Record<string, unknown>).src as string;
      }
    }
    return normalized as unknown as DSLNode;
  }

  if (obj.type != null && typeof obj.type === 'string' && KNOWN_NODE_KEYS.has(obj.type as string)) {
    const out = { ...obj };
    if (Array.isArray(out.children)) {
      out.children = out.children
        .map(normalizeNode)
        .filter((n): n is DSLNode => n != null);
    }
    if (out.type === 'hero') {
      const cta = (out.cta as Record<string, unknown> | string) ?? undefined;
      if (cta != null && typeof cta === 'object' && typeof (cta as Record<string, unknown>).label === 'string') {
        out.cta = (cta as Record<string, unknown>).label as string;
      }
      const img = (out.image as Record<string, unknown> | string) ?? undefined;
      if (img != null && typeof img === 'object' && typeof (img as Record<string, unknown>).src === 'string') {
        out.image = (img as Record<string, unknown>).src as string;
      }
    }
    return out as unknown as DSLNode;
  }

  return null;
}

function normalizeRootChildren(children: unknown[]): DSLNode[] {
  return children
    .map((child) => normalizeNode(child))
    .filter((n): n is DSLNode => n != null);
}

export class DSLParseError extends Error {
  override name = 'DSLParseError';
}

export class DSLValidationError extends Error {
  override name = 'DSLValidationError';
}

export function parseDSL(input: string): DSLRoot {
  let cleaned = input.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new DSLParseError(
      `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  if (parsed == null || typeof parsed !== 'object') {
    throw new DSLValidationError('DSL root must be an object');
  }
  const obj = parsed as Record<string, unknown>;

  if (typeof obj.page === 'string' && Array.isArray(obj.children)) {
    const root: DSLRoot = {
      page: obj.page,
      children: normalizeRootChildren(obj.children),
    };
    if (typeof obj.width === 'number') root.width = obj.width;
    if (obj.tokens != null && typeof obj.tokens === 'object') root.tokens = obj.tokens as DSLRoot['tokens'];
    return root;
  }

  const asNode = normalizeNode(obj);
  if (asNode != null) {
    const pageName = typeof obj.name === 'string' ? obj.name : 'Imported';
    return {
      page: pageName,
      width: typeof obj.width === 'number' ? obj.width : undefined,
      children: [asNode],
    };
  }

  throw new DSLValidationError(
    'DSL root must have "page" (string) and "children" (array), or be a single DSL node (e.g. type "frame" with children)'
  );
}
