import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("MsqdxGlassPainGoalsCornerShell", () => {
  it("uses corner-tab section without material icons in the tab toolbar", () => {
    const source = readFileSync(
      resolve(process.cwd(), "components/generic/msqdx-glass-pain-goals-corner-shell.tsx"),
      "utf8"
    );
    expect(source).toContain("MsqdxGlassCornerTabSection");
    expect(source).toContain('placement = "top-right"');
    expect(source).toContain("tabActions");
    expect(source).toContain("ChipEditorCornerTabToolbar");
    expect(source).not.toContain("renderChipEditorCornerTab");
    expect(source).not.toContain("psychology");
    expect(source).not.toContain("MsqdxIcon");
    expect(source).toContain("resolveChipEditorCornerTabStyle");
  });
});
