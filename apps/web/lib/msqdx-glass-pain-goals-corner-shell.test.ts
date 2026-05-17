import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("MsqdxGlassPainGoalsCornerShell", () => {
  it("wraps slider content with MsqdxCornerTabCard for pain and goal", () => {
    const source = readFileSync(
      resolve(process.cwd(), "components/generic/msqdx-glass-pain-goals-corner-shell.tsx"),
      "utf8"
    );
    expect(source).toContain("MsqdxCornerTabCard");
    expect(source).toContain("../../lib/msqdx-corner-tab-card");
    expect(source).toContain('placement = "top-right"');
    expect(source).toContain("tabActions");
    expect(source).toContain("tabWidthAuto");
    expect(source).toContain("ChipEditorCornerTabContent");
    expect(source).toContain("resolveChipEditorCornerTabStyle");
  });
});
