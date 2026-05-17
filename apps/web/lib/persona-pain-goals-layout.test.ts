import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("persona pain-goals layout", () => {
  it("uses horizontal slider layout (3.5 visible) in the pain-goals card", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "components/dashboard-cards/msqdx-glass-pain-points-goals-card.tsx"
      ),
      "utf8"
    );
    expect(source).toContain('chipLayout="slider"');
    expect(source).toContain("slidesVisible={3.5}");
    expect(source).toContain("msqdx-glass-pain-goals-stack");
    expect(source).not.toContain("msqdx-glass-pain-goals-panel-card");
    expect(source).toContain("msqdx-glass-pain-goals-stack__block");
    expect(source).toContain("embedInSection");
    expect(source).toContain('cornerTabPlacement="top-right"');
    expect(source).not.toContain('cornerTabPlacement="top-left"');
  });

  it("does not wrap pain/goals in bordered panel cards", () => {
    const css = readFileSync(
      resolve(process.cwd(), "styles/dashboard-cards.css"),
      "utf8"
    );
    expect(css).not.toContain(".msqdx-glass-pain-goals-panel-card");
    expect(css).toContain(".msqdx-glass-pain-goals-stack__block");
    expect(css).toContain(".msqdx-glass-chip-editor__section-heading h3.MuiTypography-root");
    expect(css).toMatch(/font-weight:\s*100/);
  });

  it("uses h3 section heading with entry count in slider layout", () => {
    const chipEditor = readFileSync(
      resolve(process.cwd(), "components/generic/msqdx-glass-chip-editor.tsx"),
      "utf8"
    );
    expect(chipEditor).toContain('variant="h3"');
    expect(chipEditor).toContain('component="h3"');
    expect(chipEditor).toContain('t("chipEditor.entryCount", { count: displayChips.length })');
    expect(chipEditor).toContain("msqdx-glass-chip-editor__section-heading");
    expect(chipEditor).toContain("SECTION_HEADING_MONO_SX");
    expect(chipEditor).toContain('weight="thin"');
  });

  it("adjusts slider visible slides from container width", () => {
    const slider = readFileSync(
      resolve(process.cwd(), "components/generic/msqdx-glass-horizontal-card-slider.tsx"),
      "utf8"
    );
    const hook = readFileSync(
      resolve(process.cwd(), "lib/use-horizontal-card-slider.ts"),
      "utf8"
    );
    expect(slider).toContain("useHorizontalCardSlider");
    expect(slider).toContain("--slider-gap-count");
    expect(hook).toContain("resolveSlidesVisibleForContainerWidth");
  });

  it("places slider chip actions in toolbar beside nav controls", () => {
    const chipEditor = readFileSync(
      resolve(process.cwd(), "components/generic/msqdx-glass-chip-editor.tsx"),
      "utf8"
    );
    expect(chipEditor).toContain("toolbarStart={sliderToolbarActions}");
    expect(chipEditor).toContain("leading={showSliderInlineHeader ? sectionHeading : undefined}");
    expect(chipEditor).toContain("MsqdxGlassPainGoalsCornerShell");
    expect(chipEditor).toContain("renderLayout=");
    expect(chipEditor).toContain("tabActions={controlsEnd}");
    expect(chipEditor).not.toContain("onCornerTabControls");
    expect(chipEditor).not.toContain("cornerTabActions");
    expect(chipEditor).toContain("showSliderInlineHeader");
    expect(chipEditor).toMatch(
      /showHeaderActions = editable && !isEditing && \(!isSliderLayout \|\| showEmptyState\)/
    );
  });

  it("aligns slider section heading and controls on one row", () => {
    const slider = readFileSync(
      resolve(process.cwd(), "components/generic/msqdx-glass-horizontal-card-slider.tsx"),
      "utf8"
    );
    const css = readFileSync(
      resolve(process.cwd(), "styles/dashboard-cards.css"),
      "utf8"
    );
    expect(slider).toContain("leading?: ReactNode");
    expect(slider).toContain("renderLayout?:");
    expect(slider).toContain("useHorizontalCardSlider");
    expect(slider).toContain("msqdx-glass-horizontal-card-slider__leading");
    expect(slider).toContain("msqdx-glass-horizontal-card-slider__controls-end");
    expect(css).toContain(".msqdx-glass-horizontal-card-slider__controls-end");
    expect(css).toMatch(
      /\.msqdx-glass-horizontal-card-slider__controls\s*\{[^}]*justify-content:\s*space-between/
    );
    expect(css).toContain(".msqdx-glass-chip-editor__corner-tab-shell--with-actions");
    expect(css).toContain(".msqdx-glass-chip-editor__corner-tab-content");
    expect(css).toContain(".msqdx-corner-tab-card__tab-box");
    expect(css).toMatch(/width:\s*fit-content/);
  });
});
