/** True when both project description and company context are blank (whitespace-only counts as empty). */
export function isProjectAiContextEmpty(description: string, companyContext: string): boolean {
  return !description.trim() && !companyContext.trim();
}
