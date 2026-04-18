import type { Locale } from "./i18n";
import { buildApiUrl } from "../app/api/_lib/backend";

export type PersonaTranslateFieldsResult = { strings: Record<string, string> };

/**
 * Admin-only: translate short persona field strings to the other UI language (en↔de).
 */
export async function translatePersonaAdminFields(
  personaId: string,
  args: { fromLocale: Locale; strings: Record<string, string> }
): Promise<PersonaTranslateFieldsResult> {
  const res = await fetch(buildApiUrl(`/api/persona-admin/${encodeURIComponent(personaId)}/translate-fields`), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from_locale: args.fromLocale, strings: args.strings }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = typeof (err as { detail?: string }).detail === "string" ? (err as { detail: string }).detail : res.statusText;
    throw new Error(detail || `translate-fields failed (${res.status})`);
  }
  return (await res.json()) as PersonaTranslateFieldsResult;
}
