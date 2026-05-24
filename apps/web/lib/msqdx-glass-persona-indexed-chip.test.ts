import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("MsqdxGlassPersonaIndexedChip", () => {
  it("defines indexed pain/goal chip with corner badge and interactions", () => {
    const chip = readFileSync(
      join(webRoot, "components/msqdx/chip/msqdx-glass-persona-indexed-chip.tsx"),
      "utf8"
    );
    expect(chip).toContain("MsqdxGlassPersonaIndexedChip");
    expect(chip).toContain("MsqdxCornerBox");
    expect(chip).toContain('"--indexed"');
    expect(chip).toContain("onDoubleClick");
    expect(chip).toContain("onRequestEdit");
    expect(chip).toContain("msqdx-glass-pain-goals-slide-card__index-corner");
  });

  it("wires chip editor slider to indexed chip component", () => {
    const editor = readFileSync(
      join(webRoot, "components/generic/msqdx-glass-chip-editor.tsx"),
      "utf8"
    );
    expect(editor).toContain("MsqdxGlassPersonaIndexedChip");
    expect(editor).toContain("showSliderAddSlide");
    expect(editor).toMatch(/showSliderAddSlide = editable && canAddMore && isSliderLayout/);
    expect(editor).toContain("msqdx-glass-pain-goals-slide-card--add-placeholder");
    expect(editor).toContain("handleSliderAddSlideClick");
    expect(editor).toContain("beginChipEdit(idx, chip)");
    expect(editor).toMatch(/useCornerTabChrome && \(chipVariant === "pain" \|\| chipVariant === "goal"\)/);
  });

  it("styles indexed chip label and hover affordance", () => {
    const css = readFileSync(join(webRoot, "styles/msqdx-glass-persona-chip.css"), "utf8");
    const dashboardCss = readFileSync(join(webRoot, "styles/dashboard-cards.css"), "utf8");
    expect(css).toContain(".msqdx-glass-persona-indexed-chip__label");
    expect(css).toMatch(/\.msqdx-glass-persona-indexed-chip__label[^}]*font-size:\s*var\(--msqdx-pain-goals-slide-label-font-size/);
    expect(dashboardCss).toContain("--msqdx-pain-goals-slide-label-font-size: 0.8125rem");
    expect(dashboardCss).toContain("--msqdx-pain-goals-slide-label-padding-block-start");
    expect(dashboardCss).toContain("--msqdx-pain-goals-slide-label-padding-inline-start");
    expect(css).toMatch(/\.msqdx-glass-persona-indexed-chip\.msqdx-glass-chip\.--dashboard\.--indexed[^}]*border:\s*none/);
    expect(css).toMatch(/\.msqdx-glass-persona-indexed-chip\.msqdx-glass-chip\.--dashboard\.--indexed[^}]*padding:\s*0/);
    expect(css).toMatch(/\.msqdx-glass-persona-indexed-chip \.msqdx-glass-pain-goals-slide-card__index-corner[^}]*margin:\s*0/);
    expect(css).toContain(".msqdx-glass-persona-indexed-chip.msqdx-glass-chip.--dashboard.--indexed.--interactive:hover");
  });
});
