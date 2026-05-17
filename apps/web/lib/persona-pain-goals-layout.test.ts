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
    expect(source).toContain("msqdx-glass-pain-goals-panel-card");
    expect(source).toContain("embedInSection");
  });

  it("styles pain and goal panel cards with xl radius and uniform primary border", () => {
    const css = readFileSync(
      resolve(process.cwd(), "styles/dashboard-cards.css"),
      "utf8"
    );
    const panelCardRule =
      /\.msqdx-glass-pain-goals-panel-card\.--(?:pain|goal)(?:,\s*\.msqdx-glass-pain-goals-panel-card\.--(?:pain|goal))?\s*\{[^}]*\}/;
    expect(css).toMatch(panelCardRule);
    const rule = css.match(panelCardRule)?.[0] ?? "";
    expect(rule).toContain("border-radius: var(--msqdx-radius-xl");
    expect(rule).toContain("border: 1px solid var(--color-text-primary");
    expect(rule).not.toContain("border-top: 3px");
    expect(css).not.toMatch(
      /\.msqdx-glass-pain-goals-panel-card\.--goal\s*\{[^}]*border-top:\s*3px/
    );
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
    expect(chipEditor).toContain("MONO_FONT_SX");
  });

  it("adjusts slider visible slides from container width", () => {
    const slider = readFileSync(
      resolve(process.cwd(), "components/generic/msqdx-glass-horizontal-card-slider.tsx"),
      "utf8"
    );
    expect(slider).toContain("resolveSlidesVisibleForContainerWidth");
    expect(slider).toContain("--slider-gap-count");
  });

  it("places slider chip actions in toolbar beside nav controls", () => {
    const chipEditor = readFileSync(
      resolve(process.cwd(), "components/generic/msqdx-glass-chip-editor.tsx"),
      "utf8"
    );
    expect(chipEditor).toContain("toolbarStart={sliderToolbarActions}");
    expect(chipEditor).toMatch(
      /showHeaderActions = editable && !isEditing && \(!isSliderLayout \|\| showEmptyState\)/
    );
  });
});
