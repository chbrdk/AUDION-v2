import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  PERSONA_V2_SECTION_HEADING_COUNT_FONT_SIZE,
  PERSONA_V2_SECTION_HEADING_FONT_SIZE,
  PERSONA_V2_SECTION_HEADING_FONT_WEIGHT,
} from "./persona-v2-section-heading";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("persona v2 section heading typography", () => {
  it("defines shared clamp size for chip-editor section headings", () => {
    expect(PERSONA_V2_SECTION_HEADING_FONT_SIZE).toBe("clamp(1.125rem, 2.5vw, 1.5rem)");
    expect(PERSONA_V2_SECTION_HEADING_COUNT_FONT_SIZE).toBe("0.9375rem");
    expect(PERSONA_V2_SECTION_HEADING_FONT_WEIGHT).toBe(100);
  });

  it("applies heading tokens under msqdx-glass-persona-v2-detail", () => {
    const css = readFileSync(join(webRoot, "styles/persona-v2-section-panel.css"), "utf8");
    expect(css).toContain("--msqdx-persona-v2-section-heading-font-size");
    expect(css).toContain(PERSONA_V2_SECTION_HEADING_FONT_SIZE);
    expect(css).toMatch(
      /\.msqdx-glass-persona-v2-detail \.msqdx-glass-chip-editor__section-heading h3\.MuiTypography-root[^}]*font-size:\s*var\(--msqdx-persona-v2-section-heading-font-size\)/
    );
    expect(css).toMatch(
      /\.msqdx-glass-persona-v2-detail \.msqdx-glass-chip-editor__section-heading h3\.MuiTypography-root[^}]*font-weight:\s*100/
    );
  });
});
