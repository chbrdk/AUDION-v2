import {
  MSQDX_LAYER_CONCEPT_PAYLOAD_FIELD,
  MSQDX_SECTION_CONCEPT_PLUGIN_DATA_KEY,
} from '../config/msqdx-section-metadata';

/**
 * Writes CREATION-provided section concept JSON onto a Figma frame via plugin data.
 */
export function applyMsqdxSectionConceptPluginData(node: SceneNode, layer: Record<string, unknown>): void {
  if (node.type !== 'FRAME') return;
  const raw = layer[MSQDX_LAYER_CONCEPT_PAYLOAD_FIELD];
  if (typeof raw !== 'string' || !raw.trim()) return;
  try {
    node.setPluginData(MSQDX_SECTION_CONCEPT_PLUGIN_DATA_KEY, raw);
  } catch (e) {
    console.warn('[msqdx] setPluginData failed', e);
  }
}
