import type { PersonaListItem, PersonaListResponse, PersonaProfile } from "@msqdx-glass/types";

function pickStr(...vals: unknown[]): string | undefined {
  for (const v of vals) {
    if (v == null || v === "") continue;
    return String(v);
  }
  return undefined;
}

function targetGroupIdFromRaw(r: Record<string, unknown>): string | null {
  const prof = r.profile;
  const tgFromProfile =
    prof && typeof prof === "object" && !Array.isArray(prof)
      ? pickStr(
          (prof as Record<string, unknown>).targetGroupId,
          (prof as Record<string, unknown>).target_group_id,
        )
      : undefined;
  const id = pickStr(r.targetGroupId, r.target_group_id, tgFromProfile);
  return id ?? null;
}

/**
 * Coerces persona list payloads from the API (camelCase or snake_case, optional nested profile) into `PersonaListItem`.
 */
export function normalizePersonaListItem(raw: unknown): PersonaListItem {
  const r = raw as Record<string, unknown>;
  const confidenceRaw = r.confidence;
  const confidence =
    typeof confidenceRaw === "number" && !Number.isNaN(confidenceRaw) ? confidenceRaw : 0;

  return {
    id: String(r.id ?? ""),
    projectId: pickStr(r.projectId, r.project_id),
    targetGroupId: targetGroupIdFromRaw(r),
    name: String(r.name ?? ""),
    segment: String(r.segment ?? ""),
    headline: String(r.headline ?? ""),
    status: String(r.status ?? ""),
    confidence,
    version: String(r.version ?? ""),
    updatedAt: (pickStr(r.updatedAt, r.updated_at) ?? null) as string | null,
    updatedBy: pickStr(r.updatedBy, r.updated_by) ?? null,
    imageUrl: (pickStr(r.imageUrl, r.image_url) ?? null) as string | null,
    avatarUrl: (pickStr(r.avatarUrl, r.avatar_url) ?? null) as string | null,
    profileCard: (r.profileCard ?? r.profile_card ?? null) as Record<string, unknown> | null,
    profile: (r.profile ?? null) as PersonaProfile | null,
  };
}

export function normalizePersonaListResponse(raw: unknown): PersonaListResponse {
  const r = raw as Record<string, unknown>;
  const itemsRaw = r.items;
  const items = Array.isArray(itemsRaw) ? itemsRaw.map(normalizePersonaListItem) : [];
  const total = typeof r.total === "number" ? r.total : items.length;
  const page = typeof r.page === "number" ? r.page : 1;
  const pageSizeRaw = r.page_size ?? r.pageSize;
  const page_size = typeof pageSizeRaw === "number" ? pageSizeRaw : 50;
  return { items, total, page, page_size };
}
