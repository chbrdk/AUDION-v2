/**
 * Derives which federation badges to show on project cards (PLEXON / CHECKION / local only).
 */

export type ProjectFederationChipKind = "plexon" | "checkion" | "local";

export type ProjectFederationFields = {
  platform_project_id?: string | null;
  checkion_project_id?: string | null;
};

export function projectFederationChipKinds(project: ProjectFederationFields): ProjectFederationChipKind[] {
  const hasPlexon = Boolean((project.platform_project_id ?? "").trim());
  const hasCheckion = Boolean((project.checkion_project_id ?? "").trim());
  if (!hasPlexon && !hasCheckion) {
    return ["local"];
  }
  const kinds: ProjectFederationChipKind[] = [];
  if (hasPlexon) kinds.push("plexon");
  if (hasCheckion) kinds.push("checkion");
  return kinds;
}
