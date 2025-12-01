import type { Conversation, ConversationSummary } from "../../../lib/chat-history";

/**
 * API Request/Response Types für Chat-Historie
 */

export type ConversationCreateRequest = {
  personaId: string;
  personaName: string;
  title: string;
  journeyId?: string;
  journeyName?: string;
  selectedPhases?: string[];
  tags?: string[];
};

export type ConversationUpdateRequest = Partial<ConversationCreateRequest> & {
  conversationId: string;
  title?: string;
  isArchived?: boolean;
};

export type ConversationListResponse = {
  conversations: ConversationSummary[];
  total: number;
  page?: number;
  pageSize?: number;
};

export type ConversationQueryParams = {
  personaId?: string;
  includeArchived?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
};

/**
 * Speichert eine Konversation im Backend
 * TODO: Implementiere Backend-API-Call wenn Backend bereit ist
 */
export async function saveConversationToBackend(conversation: Conversation): Promise<void> {
  // TODO: Implementiere Backend-API-Call
  // const response = await fetch("/api/chat-history", {
  //   method: "POST",
  //   headers: {
  //     "Content-Type": "application/json",
  //   },
  //   body: JSON.stringify(conversation),
  // });
  // if (!response.ok) {
  //   const error = await response.text().catch(() => "Unknown error");
  //   throw new Error(`Failed to save conversation: ${error}`);
  // }
  console.log("Backend save not yet implemented", conversation);
}

/**
 * Lädt eine Konversation aus dem Backend
 * TODO: Implementiere Backend-API-Call wenn Backend bereit ist
 */
export async function loadConversationFromBackend(conversationId: string): Promise<Conversation | null> {
  // TODO: Implementiere Backend-API-Call
  // const response = await fetch(`/api/chat-history/${conversationId}`);
  // if (!response.ok) {
  //   if (response.status === 404) return null;
  //   const error = await response.text().catch(() => "Unknown error");
  //   throw new Error(`Failed to load conversation: ${error}`);
  // }
  // return response.json();
  console.log("Backend load not yet implemented", conversationId);
  return null;
}

/**
 * Lädt alle Konversationen aus dem Backend
 * TODO: Implementiere Backend-API-Call wenn Backend bereit ist
 */
export async function loadConversationsFromBackend(
  params: ConversationQueryParams
): Promise<ConversationListResponse> {
  // TODO: Implementiere Backend-API-Call
  // const queryParams = new URLSearchParams();
  // if (params.personaId) queryParams.append("personaId", params.personaId);
  // if (params.includeArchived) queryParams.append("includeArchived", "true");
  // if (params.search) queryParams.append("search", params.search);
  // if (params.page) queryParams.append("page", params.page.toString());
  // if (params.pageSize) queryParams.append("pageSize", params.pageSize.toString());
  // const response = await fetch(`/api/chat-history?${queryParams.toString()}`);
  // if (!response.ok) {
  //   const error = await response.text().catch(() => "Unknown error");
  //   throw new Error(`Failed to load conversations: ${error}`);
  // }
  // return response.json();
  console.log("Backend load all not yet implemented", params);
  return { conversations: [], total: 0 };
}

/**
 * Löscht eine Konversation im Backend
 * TODO: Implementiere Backend-API-Call wenn Backend bereit ist
 */
export async function deleteConversationFromBackend(conversationId: string): Promise<void> {
  // TODO: Implementiere Backend-API-Call
  // const response = await fetch(`/api/chat-history/${conversationId}`, {
  //   method: "DELETE",
  // });
  // if (!response.ok) {
  //   const error = await response.text().catch(() => "Unknown error");
  //   throw new Error(`Failed to delete conversation: ${error}`);
  // }
  console.log("Backend delete not yet implemented", conversationId);
}

/**
 * Archiviert eine Konversation im Backend
 * TODO: Implementiere Backend-API-Call wenn Backend bereit ist
 */
export async function archiveConversationInBackend(
  conversationId: string,
  archived: boolean
): Promise<void> {
  // TODO: Implementiere Backend-API-Call
  // const response = await fetch(`/api/chat-history/${conversationId}/archive`, {
  //   method: "PATCH",
  //   headers: {
  //     "Content-Type": "application/json",
  //   },
  //   body: JSON.stringify({ archived }),
  // });
  // if (!response.ok) {
  //   const error = await response.text().catch(() => "Unknown error");
  //   throw new Error(`Failed to archive conversation: ${error}`);
  // }
  console.log("Backend archive not yet implemented", conversationId, archived);
}

