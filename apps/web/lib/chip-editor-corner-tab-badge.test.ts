import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("ChipEditorCornerTabBadge", () => {
  it("uses top-right MsqdxCornerBox geometry for inline controls", () => {
    const source = readFileSync(
      resolve(process.cwd(), "lib/chip-editor-corner-tab-badge.tsx"),
      "utf8"
    );
    expect(source).toContain("MsqdxCornerBox");
    expect(source).toContain('placement = "top-right"');
    expect(source).toContain("msqdx-glass-chip-editor__corner-tab-badge");
    expect(source).toContain("getCornerTabCardLayout");
  });
});
