export const PERSONAS_OVERVIEW_VIEW_MODE_STORAGE_KEY = "audion-personas-overview-view";

export type PersonasOverviewViewMode = "cards" | "list";

export const PERSONAS_OVERVIEW_VIEW_MODES: readonly PersonasOverviewViewMode[] = ["cards", "list"];

export function isPersonasOverviewViewMode(
  value: string | null | undefined
): value is PersonasOverviewViewMode {
  return value === "cards" || value === "list";
}

export function normalizePersonasOverviewViewMode(
  value: string | null | undefined
): PersonasOverviewViewMode | null {
  return isPersonasOverviewViewMode(value) ? value : null;
}

export function readPersonasOverviewViewModeFromStorage(): PersonasOverviewViewMode | null {
  if (typeof localStorage === "undefined") return null;
  return normalizePersonasOverviewViewMode(
    localStorage.getItem(PERSONAS_OVERVIEW_VIEW_MODE_STORAGE_KEY)
  );
}

export function writePersonasOverviewViewModeToStorage(mode: PersonasOverviewViewMode): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(PERSONAS_OVERVIEW_VIEW_MODE_STORAGE_KEY, mode);
}
