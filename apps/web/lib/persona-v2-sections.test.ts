import { describe, it, expect } from "vitest";
import {
  PERSONA_V2_SECTION_IDS,
  PERSONA_V2_SECTIONS,
  PERSONA_V2_DEFAULT_SECTION,
  PERSONA_V2_SECTION_LEGACY_ALIASES,
  isPersonaV2SectionId,
  personaV2SectionHref,
  resolvePersonaV2SectionId,
} from "./persona-v2-sections";

describe("persona-v2-sections", () => {
  it("has unique section ids", () => {
    const ids = PERSONA_V2_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("matches exported id list", () => {
    expect(PERSONA_V2_SECTION_IDS).toEqual(PERSONA_V2_SECTIONS.map((s) => s.id));
  });

  it("defaults to profile & bio (basics)", () => {
    expect(PERSONA_V2_DEFAULT_SECTION).toBe("basics");
  });

  it("builds section hrefs", () => {
    expect(personaV2SectionHref("abc", "moodboard")).toBe("/admin/personas-v2/abc/moodboard");
  });

  it("validates section ids", () => {
    expect(isPersonaV2SectionId("basics")).toBe(true);
    expect(isPersonaV2SectionId("bio")).toBe(false);
    expect(isPersonaV2SectionId("unknown")).toBe(false);
  });

  it("merges legacy bio, overview, and advanced routes into basics", () => {
    expect(PERSONA_V2_SECTION_LEGACY_ALIASES.bio).toBe("basics");
    expect(PERSONA_V2_SECTION_LEGACY_ALIASES.overview).toBe("basics");
    expect(PERSONA_V2_SECTION_LEGACY_ALIASES.advanced).toBe("basics");
    expect(resolvePersonaV2SectionId("bio")).toBe("basics");
    expect(resolvePersonaV2SectionId("overview")).toBe("basics");
    expect(resolvePersonaV2SectionId("advanced")).toBe("basics");
    expect(resolvePersonaV2SectionId("basics")).toBe("basics");
    expect(isPersonaV2SectionId("overview")).toBe(false);
    expect(isPersonaV2SectionId("advanced")).toBe(false);
    expect(resolvePersonaV2SectionId("unknown")).toBeNull();
    expect(PERSONA_V2_SECTION_IDS).not.toContain("bio");
    expect(PERSONA_V2_SECTION_IDS).not.toContain("overview");
    expect(PERSONA_V2_SECTION_IDS).not.toContain("advanced");
  });
});
