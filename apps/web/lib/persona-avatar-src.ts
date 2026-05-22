import { buildApiUrl } from "../app/api/_lib/backend";

/** Avoid mixed content: proxy avatar when API returns http/localhost on HTTPS pages. */
export function safePersonaAvatarSrc(
  avatarUrl: string | null | undefined,
  personaId: string | undefined
): string | undefined {
  if (!avatarUrl || !personaId) return avatarUrl ?? undefined;
  if (avatarUrl.startsWith("data:")) return avatarUrl;
  if (
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    (avatarUrl.startsWith("http://") || avatarUrl.includes("localhost"))
  ) {
    return buildApiUrl(`/api/persona-admin/${personaId}/avatar`);
  }
  return avatarUrl;
}
