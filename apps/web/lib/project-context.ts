/** True when description and company context are blank in all given language columns. */
export function isProjectAiContextEmpty(
  description: string,
  companyContext: string,
  descriptionDe?: string,
  companyContextDe?: string
): boolean {
  const descEmpty = !description.trim() && !(descriptionDe?.trim());
  const ctxEmpty = !companyContext.trim() && !(companyContextDe?.trim());
  return descEmpty && ctxEmpty;
}
