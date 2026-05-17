import { describe, expect, it } from "vitest";
import {
  CHIP_EDITOR_CORNER_SHELL_SURFACE,
  renderChipEditorCornerTab,
  resolveChipEditorCornerTabStyle,
} from "./chip-editor-corner-tab";

describe("chip-editor-corner-tab", () => {
  it("uses shared surface token for shell background", () => {
    expect(CHIP_EDITOR_CORNER_SHELL_SURFACE).toContain("--msqdx-pain-goals-corner-surface");
  });

  it("returns pink icon accent for pain", () => {
    expect(resolveChipEditorCornerTabStyle("pain")?.iconColor).toContain("pink");
  });

  it("returns blue icon accent for goal", () => {
    expect(resolveChipEditorCornerTabStyle("goal")?.iconColor).toContain("blue");
  });

  it("skips corner tab for unrelated chip variants", () => {
    expect(resolveChipEditorCornerTabStyle("trait")).toBeNull();
    expect(renderChipEditorCornerTab("trait", "Label")).toBeUndefined();
  });
});
