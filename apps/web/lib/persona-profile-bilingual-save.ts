import type { Locale } from "./i18n/index";
import type { PersonaProfile, PersonaResponse } from "@msqdx-glass/types";
import type { translatePersonaAdminFields } from "./persona-translate-fields";

export type TranslateFn = typeof translatePersonaAdminFields;

const TOP_STRING_KEYS = ["bio", "location", "full_name"] as const;

const LIST_KEYS = ["interests", "values", "social_media_usage"] as const;

/** Chip text uses spaces; persisted trait keys use underscores (see persona admin). */
export function traitHumanFromKey(key: string): string {
  return key.replace(/_/g, " ").trim();
}

export function traitKeyFromHuman(human: string): string {
  const t = human.trim().replace(/\s+/g, "_");
  return t.length > 0 ? t : "trait";
}

/** Flat keys `traitk_0`… for translate-fields (DE UI → EN canonical keys). */
export function buildTraitKeyTranslateChunk(traits: Record<string, number>): Record<string, string> {
  const keys = Object.keys(traits).sort();
  const out: Record<string, string> = {};
  keys.forEach((k, i) => {
    const h = traitHumanFromKey(k);
    if (h.length > 0) out[`traitk_${i}`] = h;
  });
  return out;
}

/** Map translated English trait labels back to underscore keys; same numeric values. */
export function rebuildTraitsAfterDeKeyTranslation(
  sourceTraits: Record<string, number>,
  tr: Record<string, string>
): Record<string, number> {
  const sortedKeys = Object.keys(sourceTraits).sort();
  const out: Record<string, number> = {};
  sortedKeys.forEach((origKey, i) => {
    const raw = tr[`traitk_${i}`]?.trim();
    const newKey = raw ? traitKeyFromHuman(raw) : origKey;
    out[newKey] = sourceTraits[origKey]!;
  });
  return out;
}

export function mergeCommunicationStyle(
  base: PersonaProfile["communication_style"],
  patch: Partial<NonNullable<PersonaProfile["communication_style"]>> | undefined
): NonNullable<PersonaProfile["communication_style"]> {
  const b = base || { vocabulary: [], sentence_structure: "", skepticism_level: 0 };
  if (!patch) return b;
  return {
    ...b,
    ...patch,
    vocabulary: patch.vocabulary !== undefined ? patch.vocabulary : b.vocabulary,
  };
}

function mergeTopLevelProfilePatch(next: PersonaProfile, updates: Partial<PersonaProfile>): PersonaProfile {
  const { communication_style, ...rest } = updates;
  let out: PersonaProfile = { ...next, ...rest };
  if (communication_style) {
    out.communication_style = mergeCommunicationStyle(next.communication_style, communication_style);
  }
  return out;
}

/** Merge chip/profile updates onto the German JSON mirror (same keys as PersonaProfile). */
export function mergeDeProfilePatch(
  baseDe: Record<string, unknown>,
  updates: Partial<PersonaProfile>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...baseDe };
  if (updates.communication_style) {
    out.communication_style = mergeCommunicationStyle(
      (baseDe.communication_style as PersonaProfile["communication_style"]) || {
        vocabulary: [],
        sentence_structure: "",
        skepticism_level: 0,
      },
      updates.communication_style
    );
  }
  for (const key of Object.keys(updates) as (keyof PersonaProfile)[]) {
    if (key === "communication_style") continue;
    const v = updates[key];
    if (v !== undefined) {
      (out as Record<string, unknown>)[key as string] = v as unknown;
    }
  }
  return out;
}

/** Flat keys for translate API; arrays use `${prefix}_${index}`. */
export function buildTranslateStringMap(updates: Partial<PersonaProfile>): Record<string, string> {
  const out: Record<string, string> = {};
  const u = updates as Record<string, unknown>;

  for (const k of TOP_STRING_KEYS) {
    if (!(k in u) || u[k] === undefined) continue;
    const v = u[k];
    out[k] = typeof v === "string" ? v : v == null ? "" : String(v);
  }

  const pushArr = (prefix: string, arr: unknown) => {
    if (!Array.isArray(arr)) return;
    arr.forEach((item, i) => {
      if (typeof item === "string" && item.trim()) {
        out[`${prefix}_${i}`] = item;
      }
    });
  };

  if ("interests" in u) pushArr("interest", u.interests);
  if ("values" in u) pushArr("value", u.values);
  if ("social_media_usage" in u) pushArr("social", u.social_media_usage);

  const cs = u.communication_style;
  if (cs && typeof cs === "object" && !Array.isArray(cs)) {
    const c = cs as Record<string, unknown>;
    if (typeof c.sentence_structure === "string") {
      out.sentence_structure = c.sentence_structure;
    }
    if (Array.isArray(c.vocabulary)) pushArr("vocab", c.vocabulary);
  }

  if (Array.isArray(u.pain_points)) {
    (u.pain_points as { label?: string }[]).forEach((pp, i) => {
      const lab = pp?.label;
      if (typeof lab === "string" && lab.trim()) out[`pp_${i}`] = lab;
    });
  }
  if (Array.isArray(u.goals)) {
    (u.goals as { label?: string }[]).forEach((g, i) => {
      const lab = g?.label;
      if (typeof lab === "string" && lab.trim()) out[`goal_${i}`] = lab;
    });
  }

  return Object.fromEntries(Object.entries(out).filter(([, v]) => v.trim().length > 0));
}

function applyFlatTranslationsToArrays(tr: Record<string, string>, prefix: string, length: number): string[] {
  const arr: string[] = [];
  for (let i = 0; i < length; i++) {
    const key = `${prefix}_${i}`;
    arr.push(tr[key]?.trim() ?? "");
  }
  return arr;
}

/** After EN `profile` was updated: patch DE string mirrors from translate (en→de). */
export function applyTranslationsToDeMirror(
  nextEn: PersonaProfile,
  nextDe: Record<string, unknown>,
  tr: Record<string, string>
): void {
  const en = nextEn as unknown as Record<string, unknown>;
  for (const k of TOP_STRING_KEYS) {
    if (tr[k]) (nextDe as Record<string, unknown>)[k] = tr[k];
  }
  const interests = en.interests;
  if (Array.isArray(interests) && interests.length > 0) {
    nextDe.interests = applyFlatTranslationsToArrays(tr, "interest", interests.length);
  }
  const values = en.values;
  if (Array.isArray(values) && values.length > 0) {
    nextDe.values = applyFlatTranslationsToArrays(tr, "value", values.length);
  }
  const sm = en.social_media_usage;
  if (Array.isArray(sm) && sm.length > 0) {
    nextDe.social_media_usage = applyFlatTranslationsToArrays(tr, "social", sm.length);
  }
  const pp = en.pain_points;
  if (Array.isArray(pp) && pp.length > 0) {
    nextDe.pain_points = pp.map((p, i) => ({
      ...p,
      label: tr[`pp_${i}`]?.trim() || p.label,
    }));
  }
  const goals = en.goals;
  if (Array.isArray(goals) && goals.length > 0) {
    nextDe.goals = goals.map((g, i) => ({
      ...g,
      label: tr[`goal_${i}`]?.trim() || g.label,
    }));
  }
  const csEn = en.communication_style as Record<string, unknown> | undefined;
  if (csEn && typeof csEn === "object") {
    const voc = csEn.vocabulary;
    const prevDe =
      typeof nextDe.communication_style === "object" && nextDe.communication_style !== null
        ? (nextDe.communication_style as Record<string, unknown>)
        : {};
    const mergedCs: Record<string, unknown> = {
      ...csEn,
      ...prevDe,
      skepticism_level: csEn.skepticism_level,
    };
    if (typeof tr.sentence_structure === "string" && tr.sentence_structure.trim()) {
      mergedCs.sentence_structure = tr.sentence_structure;
    }
    if (Array.isArray(voc) && voc.length > 0) {
      mergedCs.vocabulary = applyFlatTranslationsToArrays(tr, "vocab", voc.length);
    }
    nextDe.communication_style = mergedCs;
  }
}

/** After DE mirror was updated: patch EN `profile` from translate (de→en). */
export function applyTranslationsToEnMirror(
  nextEn: PersonaProfile,
  tr: Record<string, string>,
  updates: Partial<PersonaProfile>
): void {
  const en = nextEn as unknown as Record<string, unknown>;
  for (const k of TOP_STRING_KEYS) {
    if (tr[k]) en[k] = tr[k];
  }
  if (updates.interests && Array.isArray(updates.interests) && updates.interests.length > 0) {
    en.interests = applyFlatTranslationsToArrays(tr, "interest", updates.interests.length);
  }
  if (updates.values && Array.isArray(updates.values) && updates.values.length > 0) {
    en.values = applyFlatTranslationsToArrays(tr, "value", updates.values.length);
  }
  if (updates.social_media_usage && Array.isArray(updates.social_media_usage) && updates.social_media_usage.length > 0) {
    en.social_media_usage = applyFlatTranslationsToArrays(tr, "social", updates.social_media_usage.length);
  }
  if (updates.pain_points && Array.isArray(updates.pain_points) && updates.pain_points.length > 0) {
    en.pain_points = updates.pain_points.map((p, i) => ({
      ...p,
      label: tr[`pp_${i}`]?.trim() || p.label,
    })) as PersonaProfile["pain_points"];
  }
  if (updates.goals && Array.isArray(updates.goals) && updates.goals.length > 0) {
    en.goals = updates.goals.map((g, i) => ({
      ...g,
      label: tr[`goal_${i}`]?.trim() || g.label,
    })) as PersonaProfile["goals"];
  }
  if (updates.communication_style) {
    const base = mergeCommunicationStyle(nextEn.communication_style, undefined);
    const voc = updates.communication_style.vocabulary;
    if (Array.isArray(voc) && voc.length > 0) {
      base.vocabulary = applyFlatTranslationsToArrays(tr, "vocab", voc.length);
    }
    if (typeof tr.sentence_structure === "string" && tr.sentence_structure.trim()) {
      base.sentence_structure = tr.sentence_structure;
    }
    if (typeof updates.communication_style.skepticism_level === "number") {
      base.skepticism_level = updates.communication_style.skepticism_level;
    }
    nextEn.communication_style = base;
  }
}

function mirrorEmptyListsBothSides(
  nextEn: PersonaProfile,
  nextDe: Record<string, unknown>,
  updates: Partial<PersonaProfile>
) {
  for (const k of LIST_KEYS) {
    const arr = updates[k];
    if (Array.isArray(arr) && arr.length === 0) {
      (nextEn as Record<string, unknown>)[k] = [];
      nextDe[k] = [];
    }
  }
  if (
    updates.communication_style?.vocabulary &&
    Array.isArray(updates.communication_style.vocabulary) &&
    updates.communication_style.vocabulary.length === 0
  ) {
    const csEn = mergeCommunicationStyle(nextEn.communication_style, { vocabulary: [] });
    nextEn.communication_style = csEn;
    const prevDeCs =
      typeof nextDe.communication_style === "object" && nextDe.communication_style !== null
        ? (nextDe.communication_style as PersonaProfile["communication_style"])
        : csEn;
    nextDe.communication_style = mergeCommunicationStyle(prevDeCs, {
      vocabulary: [],
    }) as unknown as Record<string, unknown>;
  }
}

function applySharedNumericFields(
  nextEn: PersonaProfile,
  nextDe: Record<string, unknown>,
  updates: Partial<PersonaProfile>
) {
  if ("age" in updates && updates.age !== undefined) {
    nextEn.age = updates.age;
    nextDe.age = updates.age;
  }
  if ("gender" in updates) {
    const g = updates.gender;
    const finalG = g && String(g).trim() !== "" ? String(g) : null;
    nextEn.gender = finalG;
    nextDe.gender = finalG;
  }
  if ("media_affinity" in updates && updates.media_affinity !== undefined) {
    nextEn.media_affinity = updates.media_affinity;
    nextDe.media_affinity = updates.media_affinity;
  }
}

function mirrorClearTopStrings(
  nextEn: PersonaProfile,
  nextDe: Record<string, unknown>,
  updates: Partial<PersonaProfile>
) {
  for (const k of TOP_STRING_KEYS) {
    if (!(k in updates)) continue;
    const cleared = updates[k as keyof PersonaProfile] === null || updates[k as keyof PersonaProfile] === "";
    if (!cleared) continue;
    if (k === "bio") {
      nextEn.bio = "";
      nextDe.bio = "";
    } else {
      const empty = updates[k as keyof PersonaProfile] === null ? null : "";
      (nextEn as Record<string, unknown>)[k] = empty;
      (nextDe as Record<string, unknown>)[k] = empty;
    }
  }
}

/**
 * Chip-based persona fields: merge into the active language (`profile` for EN, `profile_de` for DE),
 * translate to the other language. Trait keys must match on both mirrors (`json_shape_compatible`):
 * we sync `profile_de.traits` from `profile.traits`. In DE UI, trait chip labels are translated to
 * English keys on both profiles after save.
 */
export async function mergeEnProfileWithDeTranslation(
  ctx: { personaId: string; detail: PersonaResponse; translate: TranslateFn; locale: Locale },
  updates: Partial<PersonaProfile>
): Promise<{ nextEn: PersonaProfile; nextDe: Record<string, unknown> } | { error: string }> {
  const { personaId, detail, translate, locale } = ctx;
  const baseDe =
    detail.profile_de && typeof detail.profile_de === "object" && !Array.isArray(detail.profile_de)
      ? { ...(detail.profile_de as Record<string, unknown>) }
      : ({} as Record<string, unknown>);

  let nextEn: PersonaProfile;
  let nextDe: Record<string, unknown>;

  if (locale === "de") {
    nextEn = { ...detail.profile };
    nextDe = mergeDeProfilePatch(baseDe, updates);
  } else {
    nextEn = mergeTopLevelProfilePatch({ ...detail.profile }, updates);
    nextDe = baseDe;
  }

  applySharedNumericFields(nextEn, nextDe, updates);
  mirrorEmptyListsBothSides(nextEn, nextDe, updates);

  if ("traits" in updates && (!updates.traits || Object.keys(updates.traits).length === 0)) {
    nextEn.traits = {};
    nextDe.traits = {};
  }

  let filtered = buildTranslateStringMap(updates);
  if (locale === "de" && updates.traits && Object.keys(updates.traits).length > 0) {
    filtered = { ...filtered, ...buildTraitKeyTranslateChunk(updates.traits) };
  }

  let tr: Record<string, string> = {};
  try {
    if (Object.keys(filtered).length > 0) {
      const fromLocale = locale === "de" ? "de" : "en";
      const res = await translate(personaId, { fromLocale, strings: filtered });
      tr = res.strings;
      if (locale === "de") {
        applyTranslationsToEnMirror(nextEn, tr, updates);
      } else {
        applyTranslationsToDeMirror(nextEn, nextDe, tr);
      }
    }
    if (locale === "de" && updates.traits && Object.keys(updates.traits).length > 0) {
      nextEn.traits = rebuildTraitsAfterDeKeyTranslation(updates.traits, tr);
      nextDe.traits = { ...nextEn.traits };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "translate_failed" };
  }

  nextDe.traits = { ...(nextEn.traits || {}) };

  mirrorClearTopStrings(nextEn, nextDe, updates);
  return { nextEn, nextDe };
}
