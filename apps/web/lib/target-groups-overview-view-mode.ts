export const TARGET_GROUPS_OVERVIEW_VIEW_MODE_STORAGE_KEY = "audion-target-groups-overview-view";

export type TargetGroupsOverviewViewMode = "cards" | "list";

export const TARGET_GROUPS_OVERVIEW_VIEW_MODES: readonly TargetGroupsOverviewViewMode[] = [
  "cards",
  "list",
];

export function isTargetGroupsOverviewViewMode(
  value: string | null | undefined
): value is TargetGroupsOverviewViewMode {
  return value === "cards" || value === "list";
}

export function readTargetGroupsOverviewViewModeFromStorage(): TargetGroupsOverviewViewMode | null {
  if (typeof localStorage === "undefined") return null;
  const saved = localStorage.getItem(TARGET_GROUPS_OVERVIEW_VIEW_MODE_STORAGE_KEY);
  return isTargetGroupsOverviewViewMode(saved) ? saved : null;
}

export function writeTargetGroupsOverviewViewModeToStorage(mode: TargetGroupsOverviewViewMode): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(TARGET_GROUPS_OVERVIEW_VIEW_MODE_STORAGE_KEY, mode);
}
