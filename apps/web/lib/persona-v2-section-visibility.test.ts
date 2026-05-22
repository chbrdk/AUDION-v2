import { describe, it, expect } from "vitest";
import { isPersonaV2SectionContentVisible } from "./persona-v2-section-visibility";

describe("persona-v2-section-visibility", () => {
  it("shows all blocks in v1 mode", () => {
    expect(isPersonaV2SectionContentVisible(undefined, "v1", "basics")).toBe(true);
    expect(isPersonaV2SectionContentVisible("basics", "v1", "personality")).toBe(true);
  });

  it("filters blocks in v2-section mode", () => {
    expect(isPersonaV2SectionContentVisible("basics", "v2-section", "basics")).toBe(true);
    expect(isPersonaV2SectionContentVisible("personality", "v2-section", "basics")).toBe(false);
    expect(isPersonaV2SectionContentVisible("moodboard", "v2-section", "moodboard")).toBe(true);
  });

  it("shows all when v2-section without visibleSection", () => {
    expect(isPersonaV2SectionContentVisible(undefined, "v2-section", "advanced")).toBe(true);
  });
});
