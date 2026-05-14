/**
 * Derives which federation badges to show on project cards (PLEXON / CHECKION / local only).
 */

export type ProjectFederationChipKind = "plexon" | "checkion" | "local";

export type ProjectFederationFields = {
  platform_project_id?: string | null;
  /** Present when created with central company context (even before platform_project_id exists). */
  platform_company_id?: string | null;
  checkion_project_id?: string | null;
};

export function projectFederationChipKinds(project: ProjectFederationFields): ProjectFederationChipKind[] {
  const hasPlexonBinding = Boolean(
    (project.platform_project_id ?? "").trim() || (project.platform_company_id ?? "").trim()
  );
  const hasCheckion = Boolean((project.checkion_project_id ?? "").trim());
  if (!hasPlexonBinding && !hasCheckion) {
    return ["local"];
  }
  const kinds: ProjectFederationChipKind[] = [];
  if (hasPlexonBinding) kinds.push("plexon");
  if (hasCheckion) kinds.push("checkion");
  return kinds;
}
