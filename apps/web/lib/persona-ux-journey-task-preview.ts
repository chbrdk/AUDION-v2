/** Truncate UX journey task text for list cards. */
export function personaUxJourneyTaskPreview(task: string | null | undefined, max = 220): string {
  const t = (task ?? "").trim();
  if (!t) return "";
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}
