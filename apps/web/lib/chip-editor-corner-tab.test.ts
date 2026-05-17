import { describe, expect, it } from "vitest";
import {
  renderChipEditorCornerTab,
  resolveChipEditorCornerTabStyle,
} from "./chip-editor-corner-tab";

describe("chip-editor-corner-tab", () => {
  it("returns pink tab styles for pain", () => {
    expect(resolveChipEditorCornerTabStyle("pain")?.tabColor).toContain("pink");
  });

  it("returns blue tab styles for goal", () => {
    expect(resolveChipEditorCornerTabStyle("goal")?.tabColor).toContain("blue");
  });

  it("skips corner tab for unrelated chip variants", () => {
    expect(resolveChipEditorCornerTabStyle("trait")).toBeNull();
    expect(renderChipEditorCornerTab("trait", "Label")).toBeUndefined();
  });
});
