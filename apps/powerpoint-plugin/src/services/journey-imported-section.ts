import { MSQDX_LAYER_CONCEPT_PAYLOAD_FIELD } from '../config/msqdx-section-metadata';

/** Serializable row for UI + canvas selection (main → iframe). */
export type JourneyImportedSectionRow = {
  nodeId: string;
  sectionId: string;
  label?: string;
  /** Short line for the list */
  summary: string;
  /** Pretty JSON for the detail panel */
  detailJson: string;
};

type PayloadShape = {
  concept?: {
    sectionId?: string;
    label?: string;
    phaseFit?: string;
    personaAngle?: string;
    informationGoal?: string;
  };
};

/**
 * Build a UI row from layer JSON after CREATION merge (before/after plugin data write).
 */
/** Validate rows from `prompt-site-to-figma-success` / `postMessage` (iframe). */
export function parseImportedSectionsPayload(raw: unknown): JourneyImportedSectionRow[] {
  if (!Array.isArray(raw)) return [];
  const out: JourneyImportedSectionRow[] = [];
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    if (
      typeof o.nodeId === 'string' &&
      typeof o.sectionId === 'string' &&
      typeof o.summary === 'string' &&
      typeof o.detailJson === 'string'
    ) {
      out.push({
        nodeId: o.nodeId,
        sectionId: o.sectionId,
        label: typeof o.label === 'string' && o.label.trim() ? o.label.trim() : undefined,
        summary: o.summary,
        detailJson: o.detailJson,
      });
    }
  }
  return out;
}

export function buildImportedSectionRow(
  nodeId: string,
  layer: Record<string, unknown>
): JourneyImportedSectionRow | null {
  const raw = layer[MSQDX_LAYER_CONCEPT_PAYLOAD_FIELD];
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const o = JSON.parse(raw) as PayloadShape;
    const c = o?.concept;
    const sectionId = typeof c?.sectionId === 'string' && c.sectionId.trim() ? c.sectionId.trim() : 'section';
    const label = typeof c?.label === 'string' && c.label.trim() ? c.label.trim() : undefined;
    const bits = [c?.phaseFit, c?.personaAngle, c?.informationGoal].filter(
      (x): x is string => typeof x === 'string' && x.trim().length > 0
    );
    const summary = bits.length ? bits.join(' · ').slice(0, 140) : sectionId;
    return {
      nodeId,
      sectionId,
      label,
      summary,
      detailJson: JSON.stringify(o, null, 2),
    };
  } catch {
    return {
      nodeId,
      sectionId: 'section',
      summary: raw.slice(0, 100),
      detailJson: raw,
    };
  }
}
