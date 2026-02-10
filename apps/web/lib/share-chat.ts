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
 * Builds the full shareable URL for a chat with the given persona.
 * Uses origin + basePath for correct deployment (e.g. /audion).
 */
export function buildShareChatUrl(params: ShareChatParams): string {
  const basePath = getApiBasePath();
  const path = `${basePath}/chat`;
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
