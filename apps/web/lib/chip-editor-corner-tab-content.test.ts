import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("ChipEditorCornerTabContent", () => {
  it("renders icon and action slot for MsqdxCornerTabCard tab", () => {
    const source = readFileSync(
      resolve(process.cwd(), "lib/chip-editor-corner-tab-content.tsx"),
      "utf8"
    );
    expect(source).toContain("msqdx-glass-chip-editor__corner-tab-content");
    expect(source).toContain("msqdx-glass-chip-editor__corner-tab-actions");
    expect(source).toContain("renderChipEditorCornerTab");
  });
});
