import { describe, it, expect, vi } from "vitest";
import type { PersonaProfile, PersonaResponse } from "@msqdx-glass/types";
import {
  buildTraitKeyTranslateChunk,
  buildTranslateStringMap,
  mergeCommunicationStyle,
  mergeEnProfileWithDeTranslation,
  rebuildTraitsAfterDeKeyTranslation,
  traitHumanFromKey,
  traitKeyFromHuman,
} from "./persona-profile-bilingual-save";

function makeProfile(over: Partial<PersonaProfile> = {}): PersonaProfile {
  return {
    id: "p1",
    name: "Test",
    segment: "seg",
    headline: "HL",
    bio: "bio",
    traits: { openness: 0.5 },
    pain_points: [],
    goals: [],
    communication_style: { vocabulary: [], sentence_structure: "", skepticism_level: 0 },
    confidence: 0.9,
    version: "1",
    created_at: "2020-01-01",
    interests: [],
    ...over,
  };
}

function makeDetail(profile: PersonaProfile, profile_de?: Record<string, unknown> | null): PersonaResponse {
  return {
    profile,
    profile_de: profile_de ?? null,
    prompt: { persona_id: "p1", system_prompt: "", template_version: "1" },
    sources: [],
    metadata: {
      personaId: "p1",
      projectId: "pr1",
      status: "draft",
      version: "1",
      confidence: 0.9,
      updatedAt: "",
      consoleUrl: "",
    },
    documents: [],
    knowledge: [],
  };
}

describe("buildTranslateStringMap", () => {
  it("flattens interests and sentence_structure", () => {
    expect(
      buildTranslateStringMap({
        interests: ["A", "B"],
        communication_style: { vocabulary: ["v1"], sentence_structure: "Short.", skepticism_level: 2 },
      } as never)
    ).toEqual({
      interest_0: "A",
      interest_1: "B",
      vocab_0: "v1",
      sentence_structure: "Short.",
    });
  });

  it("flattens pain point and goal labels", () => {
    expect(
      buildTranslateStringMap({
        pain_points: [{ label: "P1", evidence_count: 1 }],
        goals: [{ label: "G1", priority: 1 }],
      } as never)
    ).toEqual({ pp_0: "P1", goal_0: "G1" });
  });
});

describe("trait key translate helpers", () => {
  it("round-trips human display and underscore keys", () => {
    expect(traitHumanFromKey("Open_Minded")).toBe("Open Minded");
    expect(traitKeyFromHuman("Open Minded")).toBe("Open_Minded");
  });

  it("buildTraitKeyTranslateChunk uses stable sorted order", () => {
    expect(buildTraitKeyTranslateChunk({ Zebra: 1, Aardvark: 0.5 })).toEqual({
      traitk_0: "Aardvark",
      traitk_1: "Zebra",
    });
  });

  it("rebuildTraitsAfterDeKeyTranslation maps API strings to keys (sorted source keys)", () => {
    const out = rebuildTraitsAfterDeKeyTranslation(
      { Mut: 0.8, Ehrlichkeit: 0.9 },
      { traitk_0: "Honesty", traitk_1: "Courage" }
    );
    expect(out).toEqual({ Honesty: 0.9, Courage: 0.8 });
  });
});

describe("mergeCommunicationStyle", () => {
  it("merges vocabulary patch", () => {
    const base = { vocabulary: ["a"], sentence_structure: "s", skepticism_level: 1 };
    expect(mergeCommunicationStyle(base, { vocabulary: ["b", "c"] })).toEqual({
      vocabulary: ["b", "c"],
      sentence_structure: "s",
      skepticism_level: 1,
    });
  });
});

describe("mergeEnProfileWithDeTranslation (chip lists)", () => {
  it("EN UI: merges interests into profile, translate en→de mirrors profile_de", async () => {
    const detail = makeDetail(
      makeProfile({ interests: ["Old"] }),
      { interests: ["Alt"], bio: "de bio" }
    );
    const translate = vi.fn(async () => ({
      strings: { interest_0: "Neu_DE", interest_1: "Zweites_DE" },
    }));
    const result = await mergeEnProfileWithDeTranslation(
      { personaId: "pid-1", detail, translate, locale: "en" },
      { interests: ["New item", "Second"] }
    );
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(translate).toHaveBeenCalledWith("pid-1", {
      fromLocale: "en",
      strings: { interest_0: "New item", interest_1: "Second" },
    });
    expect(result.nextEn.interests).toEqual(["New item", "Second"]);
    expect(result.nextDe.interests).toEqual(["Neu_DE", "Zweites_DE"]);
  });

  it("DE UI: merges interests into profile_de, translate de→en updates profile", async () => {
    const detail = makeDetail(makeProfile({ interests: ["OldEn"] }), {
      interests: ["AltDe"],
      bio: "de bio",
    });
    const translate = vi.fn(async () => ({
      strings: { interest_0: "Cycling EN", interest_1: "Cooking EN" },
    }));
    const result = await mergeEnProfileWithDeTranslation(
      { personaId: "pid-2", detail, translate, locale: "de" },
      { interests: ["Radfahren", "Kochen"] }
    );
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(translate).toHaveBeenCalledWith("pid-2", {
      fromLocale: "de",
      strings: { interest_0: "Radfahren", interest_1: "Kochen" },
    });
    expect(result.nextDe.interests).toEqual(["Radfahren", "Kochen"]);
    expect(result.nextEn.interests).toEqual(["Cycling EN", "Cooking EN"]);
  });

  it("traits-only update skips translate and mirrors traits on both sides", async () => {
    const detail = makeDetail(makeProfile({ traits: { openness: 0.1 } }), {});
    const translate = vi.fn();
    const result = await mergeEnProfileWithDeTranslation(
      { personaId: "p", detail, translate, locale: "en" },
      { traits: { openness: 0.9 } }
    );
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(translate).not.toHaveBeenCalled();
    expect(result.nextEn.traits).toEqual({ openness: 0.9 });
    expect(result.nextDe.traits).toEqual({ openness: 0.9 });
  });

  it("EN UI: values use same translate path as interests", async () => {
    const detail = makeDetail(makeProfile({ values: ["Alt"] }), { values: ["De alt"] });
    const translate = vi.fn(async () => ({ strings: { value_0: "Gerechtigkeit DE" } }));
    const result = await mergeEnProfileWithDeTranslation(
      { personaId: "pv", detail, translate, locale: "en" },
      { values: ["Justice"] }
    );
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(translate).toHaveBeenCalledWith("pv", {
      fromLocale: "en",
      strings: { value_0: "Justice" },
    });
    expect(result.nextEn.values).toEqual(["Justice"]);
    expect(result.nextDe.values).toEqual(["Gerechtigkeit DE"]);
  });

  it("EN UI: copies profile.traits onto profile_de after chip save (shape-safe)", async () => {
    const detail = makeDetail(
      makeProfile({ traits: { honesty: 0.8 }, values: ["x"] }),
      { traits: { wrong: 0.1 }, values: ["de"] }
    );
    const translate = vi.fn(async () => ({ strings: { value_0: "Y DE" } }));
    const result = await mergeEnProfileWithDeTranslation(
      { personaId: "ps", detail, translate, locale: "en" },
      { values: ["Y"] }
    );
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.nextDe.traits).toEqual({ honesty: 0.8 });
  });

  it("DE UI: translates trait labels to EN keys on both profiles", async () => {
    const detail = makeDetail(
      makeProfile({ traits: { legacy_en: 0.1 }, interests: [] }),
      { interests: [], bio: "de" }
    );
    const translate = vi.fn(async () => ({
      strings: { traitk_0: "Honesty", traitk_1: "Courage" },
    }));
    const result = await mergeEnProfileWithDeTranslation(
      { personaId: "pt", detail, translate, locale: "de" },
      { traits: { Ehrlichkeit: 0.9, Mut: 0.7 } }
    );
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(translate).toHaveBeenCalledWith(
      "pt",
      expect.objectContaining({
        fromLocale: "de",
        strings: expect.objectContaining({
          traitk_0: "Ehrlichkeit",
          traitk_1: "Mut",
        }),
      })
    );
    expect(result.nextEn.traits).toEqual({ Honesty: 0.9, Courage: 0.7 });
    expect(result.nextDe.traits).toEqual({ Honesty: 0.9, Courage: 0.7 });
  });
});
