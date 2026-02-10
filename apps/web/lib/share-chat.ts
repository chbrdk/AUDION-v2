/**
 * Builds shareable chat URLs.
 * Paths are defined in knowledge/chat-share-paths.md.
 */

import { getApiBasePath } from "../app/api/_lib/backend";

export type ShareChatParams = {
  personaId: string;
  projectId: string;
  /** Optional: for same-user/same-device restore from localStorage */
  conversationId?: string;
};

/**
 * Resolves the effective base path from the current URL.
 * Ensures share links work regardless of deployment (/, /audion, etc.).
 */
function getEffectiveBasePath(): string {
  if (typeof window === "undefined") {
    return getApiBasePath();
  }
  const pathname = window.location.pathname;
  // Derive base from current path: /admin/... → "", /audion/admin/... → /audion
  const adminMatch = pathname.match(/^(.*?)\/admin/);
  if (adminMatch) {
    const prefix = adminMatch[1];
    return prefix || "";
  }
  return getApiBasePath();
}

/**
 * Builds the full shareable URL for a chat with the given persona.
 * Uses the effective base path from the current page for correct deployment.
 */
export function buildShareChatUrl(params: ShareChatParams): string {
  const basePath = getEffectiveBasePath();
  const path = basePath ? `${basePath}/chat` : "/chat";
  const search = new URLSearchParams({
    personaId: params.personaId,
    projectId: params.projectId,
  });
  if (params.conversationId) {
    search.set("conversationId", params.conversationId);
  }
  if (typeof window !== "undefined") {
    return `${window.location.origin}${path}?${search.toString()}`;
  }
  return `${path}?${search.toString()}`;
}
