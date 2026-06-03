/** Target group lifecycle values (see `apps/api/app/services/target_group_lifecycle.py`). */
export const TARGET_GROUP_LIFECYCLE = {
  active: "active",
  archived: "archived",
} as const;

export type TargetGroupLifecycleStatus =
  (typeof TARGET_GROUP_LIFECYCLE)[keyof typeof TARGET_GROUP_LIFECYCLE];

const LEGACY_ACTIVE = new Set(["draft", "published", "active", ""]);

/** Read status from API/DB — maps legacy draft/published to active. */
export function coerceTargetGroupStatus(
  value?: string | null
): TargetGroupLifecycleStatus {
  const s = (value ?? "").trim().toLowerCase();
  if (s === TARGET_GROUP_LIFECYCLE.archived) {
    return TARGET_GROUP_LIFECYCLE.archived;
  }
  return TARGET_GROUP_LIFECYCLE.active;
}

export function isTargetGroupArchived(value?: string | null): boolean {
  return coerceTargetGroupStatus(value) === TARGET_GROUP_LIFECYCLE.archived;
}

export function isLegacyActiveTargetGroupStatus(value?: string | null): boolean {
  return LEGACY_ACTIVE.has((value ?? "").trim().toLowerCase());
}
