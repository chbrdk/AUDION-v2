import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  PERSONALITY_CHIP_FONT_SIZE,
  PERSONALITY_CHIP_FONT_WEIGHT,
  PERSONALITY_CHIP_PADDING,
  PERSONALITY_GRID_CHIP_PROPS,
  PERSONALITY_GRID_WIDE_MIN_WIDTH_PX,
  PERSONALITY_TRAIT_CHIP_PROPS,
} from "./persona-personality-chip-layout";

describe("persona personality layout", () => {
  it("uses inline traits and 2→3 col grid for interests/values", () => {
    const source = readFileSync(
      resolve(process.cwd(), "components/dashboard-cards/msqdx-glass-personality-card.tsx"),
      "utf8"
    );
    expect(source).toContain("PERSONALITY_TRAIT_CHIP_PROPS");
    expect(source).toContain("PERSONALITY_GRID_CHIP_PROPS");
    expect(PERSONALITY_TRAIT_CHIP_PROPS.chipLayout).toBe("inline");
    expect(PERSONALITY_GRID_CHIP_PROPS.chipLayout).toBe("grid");
    expect(source).not.toContain('chipLayout: "slider"');
    expect(source).toContain("msqdx-glass-personality-stack");
    expect(source).toContain("embedInSection");
  });

  it("exposes grid layout on chip editor", () => {
    const chipEditor = readFileSync(
      resolve(process.cwd(), "components/generic/msqdx-glass-chip-editor.tsx"),
      "utf8"
    );
    expect(chipEditor).toContain('"grid"');
    expect(chipEditor).toContain("msqdx-glass-chip-editor__chips--grid");
    expect(chipEditor).toContain("gridColumns");
  });

  it("excludes dashboard chips from globals mobile chip reset", () => {
    const globals = readFileSync(resolve(process.cwd(), "styles/globals.css"), "utf8");
    expect(globals).toMatch(
      /@media \(max-width:\s*959px\)[\s\S]*\.msqdx-glass-chip:not\(\.--dashboard\)/
    );
  });

  it("uniform chip font and responsive grid in CSS", () => {
    const css = readFileSync(resolve(process.cwd(), "styles/dashboard-cards.css"), "utf8");
    expect(css).toContain("--msqdx-personality-chip-font-size");
    expect(css).toContain("--msqdx-personality-chip-font-weight");
    expect(css).toContain("--msqdx-personality-chip-padding");
    expect(css).toContain(PERSONALITY_CHIP_FONT_SIZE);
    expect(css).toContain(PERSONALITY_CHIP_FONT_WEIGHT);
    expect(css).toContain(PERSONALITY_CHIP_PADDING);
    expect(css).toMatch(
      /\.msqdx-glass-personality-section \.msqdx-glass-chip\.--dashboard\.--trait[^}]*font-size:\s*var\(--msqdx-personality-chip-font-size\)/
    );
    expect(css).toMatch(
      /\.msqdx-glass-personality-section \.msqdx-glass-chip\.--dashboard\.--interest[^}]*font-weight:\s*var\(--msqdx-personality-chip-font-weight\)\s*!important/
    );
    expect(css).toMatch(
      /@media \(max-width:\s*959px\)[\s\S]*\.msqdx-glass-personality-section \.msqdx-glass-chip\.--dashboard[^}]*font-size:\s*var\(--msqdx-personality-chip-font-size\)\s*!important/
    );
    expect(css).toMatch(
      new RegExp(
        `@media \\(min-width:\\s*${PERSONALITY_GRID_WIDE_MIN_WIDTH_PX}px\\)[\\s\\S]*grid-template-columns:\\s*repeat\\(3`
      )
    );
    expect(css).toContain(
      ".msqdx-glass-personality-stack__block.--interest .msqdx-glass-chip-editor__chips--grid"
    );
    expect(css).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
    expect(css).toContain("grid-template-columns: repeat(3, minmax(0, 1fr))");
  });

  it("passes embedInSection from persona admin panel for v2 sections", () => {
    const panel = readFileSync(
      resolve(process.cwd(), "components/msqdx-glass-persona-admin-panel.tsx"),
      "utf8"
    );
    expect(panel).toMatch(
      /MsqdxGlassPersonalityCard[\s\S]*?embedInSection=\{isV2Section\}/
    );
  });
});
