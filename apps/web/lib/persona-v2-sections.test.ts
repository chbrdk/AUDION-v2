import { describe, it, expect } from "vitest";
import {
  PERSONA_V2_SECTION_IDS,
  PERSONA_V2_SECTIONS,
  PERSONA_V2_DEFAULT_SECTION,
  isPersonaV2SectionId,
  personaV2SectionHref,
} from "./persona-v2-sections";

describe("persona-v2-sections", () => {
  it("has unique section ids", () => {
    const ids = PERSONA_V2_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("matches exported id list", () => {
    expect(PERSONA_V2_SECTION_IDS).toEqual(PERSONA_V2_SECTIONS.map((s) => s.id));
  });

  it("defaults to overview", () => {
    expect(PERSONA_V2_DEFAULT_SECTION).toBe("overview");
  });

  it("builds section hrefs", () => {
    expect(personaV2SectionHref("abc", "moodboard")).toBe("/admin/personas-v2/abc/moodboard");
  });

  it("validates section ids", () => {
    expect(isPersonaV2SectionId("basics")).toBe(true);
    expect(isPersonaV2SectionId("unknown")).toBe(false);
  });
});
