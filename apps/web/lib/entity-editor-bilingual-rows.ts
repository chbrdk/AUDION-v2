import type { FieldDefinition } from "@msqdx-glass/types";

const DE_SUFFIX = "_de";

export type BilingualFieldRow =
  | { kind: "pair"; en: FieldDefinition; de: FieldDefinition }
  | { kind: "single"; field: FieldDefinition };

/** Pair EN fields with their `*_de` mirror for side-by-side editor rows. */
export function buildBilingualFieldRows(fields: FieldDefinition[]): BilingualFieldRow[] {
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const consumed = new Set<string>();
  const rows: BilingualFieldRow[] = [];
  const sorted = [...fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  for (const field of sorted) {
    if (consumed.has(field.key)) {
      continue;
    }

    if (field.key.endsWith(DE_SUFFIX)) {
      const baseKey = field.key.slice(0, -DE_SUFFIX.length);
      const en = byKey.get(baseKey);
      if (en && !consumed.has(baseKey)) {
        consumed.add(baseKey);
        consumed.add(field.key);
        rows.push({ kind: "pair", en, de: field });
        continue;
      }
    }

    const deKey = `${field.key}${DE_SUFFIX}`;
    const de = byKey.get(deKey);
    if (de && !consumed.has(deKey)) {
      consumed.add(field.key);
      consumed.add(deKey);
      rows.push({ kind: "pair", en: field, de });
      continue;
    }

    consumed.add(field.key);
    rows.push({ kind: "single", field });
  }

  return rows;
}

export function hasBilingualFieldPairs(fields: FieldDefinition[]): boolean {
  return buildBilingualFieldRows(fields).some((row) => row.kind === "pair");
}
