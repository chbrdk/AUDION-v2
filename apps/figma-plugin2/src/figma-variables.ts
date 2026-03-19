/**
 * Syncs a full Tailwind-style token set to Figma variables and returns a map for binding.
 * Runs only in plugin context. Call from code.ts before wireframe generation.
 */

import { getTailwindTokenList } from './agent/tailwind-tokens';
import type { SemanticVariableKey } from './agent/tailwind-tokens';

const COLLECTION_NAME = 'Tailwind';

/** Map of variable key (e.g. "colors-primary", "radius-md") -> Figma Variable for binding. */
export type WireframeVariableMap = Record<string, Variable>;

function getFigmaVariables(): typeof figma.variables | null {
  if (typeof figma === 'undefined') return null;
  return (figma as any).variables ?? null;
}

/**
 * Ensures the Tailwind variable collection exists and all tokens are created as Figma variables.
 * Returns a map of token key -> Variable so generated nodes can bind to them.
 */
export async function getOrCreateWireframeVariables(): Promise<WireframeVariableMap | null> {
  const varsApi = getFigmaVariables();
  if (!varsApi) return null;

  const collections = await varsApi.getLocalVariableCollectionsAsync();
  let collection = collections.find((c) => c.name === COLLECTION_NAME) ?? null;
  if (!collection) {
    collection = varsApi.createVariableCollection(COLLECTION_NAME);
  }
  const modeId = collection.modes[0].modeId;

  const list = getTailwindTokenList();
  const result: Record<string, Variable> = {};

  for (const entry of list) {
    // Figma variable name: prefix to avoid clashes, key is already hyphen-only
    const name = `tw-${entry.key}`;
    let existing: Variable | null = null;
    for (const id of collection.variableIds) {
      const v = await varsApi.getVariableByIdAsync(id);
      if (v != null && v.name === name) {
        existing = v;
        break;
      }
    }

    let variable: Variable;
    if (existing) {
      variable = existing;
    } else {
      variable = varsApi.createVariable(name, collection, entry.type);
    }

    if (entry.type === 'COLOR') {
      variable.setValueForMode(modeId, entry.value);
    } else {
      variable.setValueForMode(modeId, entry.value);
    }

    result[entry.key] = variable;
  }

  return result;
}

/** Keys used by molecules when binding (semantic). */
export type { SemanticVariableKey };
