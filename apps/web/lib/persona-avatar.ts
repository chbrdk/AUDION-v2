import { buildApiUrl } from "../app/api/_lib/backend";
import { API_ROUTES } from "./api-routes";

/** Avoid Mixed Content: use same-origin proxy when avatar URL is http/localhost on HTTPS pages. */
export function safePersonaAvatarSrc(avatarUrl: string | null | undefined, personaId: string): string | undefined {
  if (!avatarUrl) return undefined;
  if (avatarUrl.startsWith("data:")) return avatarUrl;

  if (
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    (avatarUrl.startsWith("http://") || avatarUrl.includes("localhost"))
  ) {
    return buildApiUrl(API_ROUTES.personaAdminAvatar(personaId));
  }

  return avatarUrl;
}

