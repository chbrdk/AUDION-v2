import { describe, expect, it } from "vitest";
import type { FieldDefinition } from "@msqdx-glass/types";
import { buildBilingualFieldRows, hasBilingualFieldPairs } from "./entity-editor-bilingual-rows";

const targetGroupFields: FieldDefinition[] = [
  { key: "name", label: "Name", type: "text", group: "basic", order: 1 },
  { key: "segment", label: "Segment", type: "text", group: "basic", order: 2 },
  { key: "description", label: "Description", type: "textarea", group: "basic", order: 3 },
  { key: "name_de", label: "Name (DE)", type: "text", group: "basic", order: 4 },
  { key: "segment_de", label: "Segment (DE)", type: "text", group: "basic", order: 5 },
  { key: "description_de", label: "Description (DE)", type: "textarea", group: "basic", order: 6 },
];

describe("buildBilingualFieldRows", () => {
  it("pairs EN and DE target group basics fields in order", () => {
    const rows = buildBilingualFieldRows(targetGroupFields);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({
      kind: "pair",
      en: targetGroupFields[0],
      de: targetGroupFields[3],
    });
    expect(rows[1]).toEqual({
      kind: "pair",
      en: targetGroupFields[1],
      de: targetGroupFields[4],
    });
    expect(rows[2]).toEqual({
      kind: "pair",
      en: targetGroupFields[2],
      de: targetGroupFields[5],
    });
    expect(hasBilingualFieldPairs(targetGroupFields)).toBe(true);
  });

  it("leaves unpaired fields as single rows", () => {
    const rows = buildBilingualFieldRows([
      { key: "title", label: "Title", type: "text", group: "basic", order: 1 },
    ]);
    expect(rows).toEqual([{ kind: "single", field: expect.objectContaining({ key: "title" }) }]);
    expect(hasBilingualFieldPairs([{ key: "title", label: "Title", type: "text", group: "basic" }])).toBe(
      false
    );
  });
});
