import { describe, expect, it } from "vitest";
import {
  CHIP_EDITOR_CORNER_BORDER_RADIUS_PX,
  CHIP_EDITOR_CORNER_SHELL_SURFACE,
  PAIN_GOALS_SLIDE_INDEX_BADGE_RADIUS_PX,
  renderChipEditorCornerTab,
  resolveChipEditorCornerTabStyle,
} from "./chip-editor-corner-tab";

describe("chip-editor-corner-tab", () => {
  it("uses shared surface token for shell background", () => {
    expect(CHIP_EDITOR_CORNER_SHELL_SURFACE).toContain("--msqdx-pain-goals-corner-surface");
  });

  it("aligns corner tab radius with card body (--msqdx-radius-3xl)", () => {
    expect(CHIP_EDITOR_CORNER_BORDER_RADIUS_PX).toBe(24);
  });

  it("exposes slider index badge radius for MsqdxCornerBox cutdown patches", () => {
    expect(PAIN_GOALS_SLIDE_INDEX_BADGE_RADIUS_PX).toBe(22);
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
