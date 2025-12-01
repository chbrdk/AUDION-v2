import type { ConversationLearning } from "../../../lib/adaptive-prompt";

/**
 * API Request/Response Types für Learnings
 */

export type LearningCreateRequest = {
  personaId?: string;
  topic: string;
  userPreference?: string;
  personaInsight?: string;
  extractedFrom: string;
  confidence?: number;
};

export type LearningUpdateRequest = Partial<LearningCreateRequest> & {
  id: string;
};

export type LearningResponse = ConversationLearning;

export type LearningListResponse = {
  learnings: LearningResponse[];
  total: number;
};

export type LearningQueryParams = {
  personaId?: string;
  topic?: string;
  limit?: number;
  offset?: number;
};

/**
 * Speichert Learnings im Backend
 * TODO: Implementiere Backend-API-Call wenn Backend bereit ist
 */
export async function saveLearningsToBackend(
  learnings: ConversationLearning[]
): Promise<void> {
  // TODO: Implementiere Backend-API-Call
  // const response = await fetch("/api/learnings", {
  //   method: "POST",
  //   headers: {
  //     "Content-Type": "application/json",
  //   },
  //   body: JSON.stringify(learnings),
  // });
  // if (!response.ok) {
  //   const error = await response.text().catch(() => "Unknown error");
  //   throw new Error(`Failed to save learnings: ${error}`);
  // }
  console.log("Backend save not yet implemented", learnings);
}

/**
 * Lädt Learnings aus dem Backend
 * TODO: Implementiere Backend-API-Call wenn Backend bereit ist
 */
export async function loadLearningsFromBackend(
  personaId?: string
): Promise<ConversationLearning[]> {
  // TODO: Implementiere Backend-API-Call
  // const params = new URLSearchParams();
  // if (personaId) {
  //   params.append("personaId", personaId);
  // }
  // const url = `/api/learnings?${params.toString()}`;
  // const response = await fetch(url);
  // if (!response.ok) {
  //   const error = await response.text().catch(() => "Unknown error");
  //   throw new Error(`Failed to load learnings: ${error}`);
  // }
  // const data: LearningListResponse = await response.json();
  // return data.learnings;
  console.log("Backend load not yet implemented", personaId);
  return [];
}

/**
 * Löscht Learnings im Backend
 * TODO: Implementiere Backend-API-Call wenn Backend bereit ist
 */
export async function deleteLearningsFromBackend(
  learningIds: string[]
): Promise<void> {
  // TODO: Implementiere Backend-API-Call
  // const response = await fetch("/api/learnings", {
  //   method: "DELETE",
  //   headers: {
  //     "Content-Type": "application/json",
  //   },
  //   body: JSON.stringify({ ids: learningIds }),
  // });
  // if (!response.ok) {
  //   const error = await response.text().catch(() => "Unknown error");
  //   throw new Error(`Failed to delete learnings: ${error}`);
  // }
  console.log("Backend delete not yet implemented", learningIds);
}

