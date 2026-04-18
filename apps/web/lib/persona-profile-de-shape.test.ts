import { describe, it, expect } from "vitest";
import { alignProfileDeToEnProfile } from "./persona-profile-de-shape";

describe("alignProfileDeToEnProfile", () => {
  it("fills missing keys from en", () => {
    const en = { a: 1, b: { c: 2 } };
    const de = { a: 1 };
    expect(alignProfileDeToEnProfile(en, de)).toEqual({ a: 1, b: { c: 2 } });
  });

  it("keeps de strings when shapes match", () => {
    const en = { bio: "EN bio", age: 30 };
    const de = { bio: "DE bio", age: 30 };
    expect(alignProfileDeToEnProfile(en, de)).toEqual({ bio: "DE bio", age: 30 });
  });

  it("replaces de list when length mismatches en", () => {
    const en = { interests: ["a", "b"] };
    const de = { interests: ["x"] };
    expect(alignProfileDeToEnProfile(en, de)).toEqual({ interests: ["a", "b"] });
  });

  it("aligns nested objects under matching keys", () => {
    const en = { communication_style: { vocabulary: ["x"], sentence_structure: "s", skepticism_level: 2 } };
    const de = { communication_style: { vocabulary: ["de"], sentence_structure: "DE", skepticism_level: 2 } };
    expect(alignProfileDeToEnProfile(en, de)).toEqual({
      communication_style: { vocabulary: ["de"], sentence_structure: "DE", skepticism_level: 2 },
    });
  });
});
