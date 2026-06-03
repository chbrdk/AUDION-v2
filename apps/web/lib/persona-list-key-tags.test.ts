import { describe, expect, it } from "vitest";
import {
  PERSONA_LIST_KEY_TAGS_MAX,
  personaListKeyTagVariant,
  pickPersonaListKeyTags,
} from "./persona-list-key-tags";

describe("pickPersonaListKeyTags", () => {
  it("prefers traits, then interests, values, goals, and pains", () => {
    const tags = pickPersonaListKeyTags({
      profileCard: {
        traits: { analytical: 1, pragmatic: 1 },
        interests: ["Cycling", "Design systems"],
        values: ["Transparency"],
        goals: [{ label: "Ship faster", priority: 1 }],
        pain_points: [{ label: "Too many tools", evidence_count: 1 }],
      },
    });
    expect(tags).toEqual(["analytical", "pragmatic", "Cycling"]);
  });

  it("falls back to profileCard when profile is missing", () => {
    const tags = pickPersonaListKeyTags({
      profile: null,
      profileCard: {
        interests: ["Music", "Travel"],
        values: ["Quality"],
      },
    });
    expect(tags).toEqual(["Music", "Travel", "Quality"]);
  });

  it("dedupes case-insensitively and respects max", () => {
    const tags = pickPersonaListKeyTags(
      {
        profileCard: {
          traits: { Focus: 1 },
          interests: ["focus", "Reading"],
        },
      },
      2
    );
    expect(tags).toEqual(["Focus", "Reading"]);
  });

  it("returns empty list when no tag source exists", () => {
    expect(pickPersonaListKeyTags({ profile: null, profileCard: null })).toEqual([]);
  });

  it("exports stable max and variant rotation", () => {
    expect(PERSONA_LIST_KEY_TAGS_MAX).toBe(3);
    expect(personaListKeyTagVariant(0)).toBe("trait");
    expect(personaListKeyTagVariant(1)).toBe("interest");
    expect(personaListKeyTagVariant(2)).toBe("value");
    expect(personaListKeyTagVariant(3)).toBe("trait");
  });
});
