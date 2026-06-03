import type { PersonaListItem } from "@msqdx-glass/types";

export const PERSONA_LIST_KEY_TAGS_MAX = 3;

type TagSource = {
  traits?: Record<string, unknown> | null;
  interests?: unknown;
  values?: unknown;
  goals?: unknown;
  pain_points?: unknown;
  painPoints?: unknown;
};

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === "string") return entry.trim();
      if (entry && typeof entry === "object" && "label" in entry) {
        const label = (entry as { label?: unknown }).label;
        return typeof label === "string" ? label.trim() : "";
      }
      return "";
    })
    .filter(Boolean);
}

function traitKeys(traits: Record<string, unknown> | null | undefined): string[] {
  if (!traits || typeof traits !== "object") return [];
  return Object.keys(traits)
    .map((key) => key.trim())
    .filter(Boolean);
}

function pickTagSource(item: Pick<PersonaListItem, "profile" | "profileCard">): TagSource | null {
  if (item.profile && typeof item.profile === "object") {
    return item.profile as TagSource;
  }
  const card = item.profileCard;
  if (card && typeof card === "object" && !Array.isArray(card)) {
    return card as TagSource;
  }
  return null;
}

/**
 * Picks a small set of persona tags for list/card previews (traits → interests → values → goals → pains).
 */
export function pickPersonaListKeyTags(
  item: Pick<PersonaListItem, "profile" | "profileCard">,
  max = PERSONA_LIST_KEY_TAGS_MAX
): string[] {
  const source = pickTagSource(item);
  if (!source) return [];

  const candidates = [
    ...traitKeys(source.traits ?? null),
    ...asStringList(source.interests),
    ...asStringList(source.values),
    ...asStringList(source.goals),
    ...asStringList(source.pain_points ?? source.painPoints),
  ];

  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of candidates) {
    const key = raw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(raw);
    if (tags.length >= max) break;
  }
  return tags;
}

export type PersonaListKeyTagVariant = "trait" | "interest" | "value";

/** Maps tag index to chip variant for visual variety in library previews. */
export function personaListKeyTagVariant(index: number): PersonaListKeyTagVariant {
  const variants: PersonaListKeyTagVariant[] = ["trait", "interest", "value"];
  return variants[index % variants.length] ?? "trait";
}
