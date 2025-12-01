import type { Message, ConversationLearning } from "./adaptive-prompt";

export type ConversationMetadata = {
  conversationId: string;
  personaId: string;
  personaName: string;
  title: string; // Auto-generiert oder manuell
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  journeyId?: string;
  journeyName?: string;
  selectedPhases?: string[];
  isArchived: boolean;
  tags?: string[];
};

export type Conversation = {
  metadata: ConversationMetadata;
  messages: Message[];
  learnings?: ConversationLearning[];
};

export type ConversationSummary = ConversationMetadata & {
  preview?: string; // Erste Nachricht oder letzte Nachricht als Preview
  lastMessageAt?: Date;
};

/**
 * Generiert einen Titel aus der ersten User-Nachricht
 */
export function generateConversationTitle(messages: Message[]): string {
  const firstUserMessage = messages.find((m) => m.role === "user");
  if (firstUserMessage && firstUserMessage.content) {
    const content = firstUserMessage.content.trim();
    if (content.length > 0) {
      // Kürze auf max. 50 Zeichen
      const title = content.length > 50 ? content.substring(0, 47) + "..." : content;
      return title;
    }
  }
  return "New Conversation";
}

/**
 * Speichert eine Konversation in LocalStorage
 */
export function saveConversationToLocalStorage(conversation: Conversation): void {
  if (typeof window === "undefined") return;
  
  try {
    const conversationKey = `chat_conversation_${conversation.metadata.conversationId}`;
    
    // Konvertiere Date-Objekte zu ISO-Strings für JSON
    const serialized = {
      ...conversation,
      metadata: {
        ...conversation.metadata,
        createdAt: conversation.metadata.createdAt.toISOString(),
        updatedAt: conversation.metadata.updatedAt.toISOString(),
      },
      messages: conversation.messages.map((msg) => ({
        ...msg,
        // Messages haben keine Date-Objekte, aber für zukünftige Erweiterungen
      })),
      learnings: conversation.learnings?.map((learning) => ({
        ...learning,
        timestamp: learning.timestamp.toISOString(),
      })),
    };
    
    // Speichere komplette Konversation
    localStorage.setItem(conversationKey, JSON.stringify(serialized));
    
    // Aktualisiere Index-Liste
    updateConversationIndex(conversation);
  } catch (error) {
    console.error("Failed to save conversation to localStorage:", error);
  }
}

/**
 * Aktualisiert den Index der Konversationen
 */
function updateConversationIndex(conversation: Conversation): void {
  if (typeof window === "undefined") return;
  
  try {
    const indexKey = "chat_conversations_index";
    const existingIndex = localStorage.getItem(indexKey);
    const index: ConversationSummary[] = existingIndex ? JSON.parse(existingIndex) : [];
    
    // Finde bestehenden Eintrag
    const existingIndexEntry = index.findIndex(
      (entry) => entry.conversationId === conversation.metadata.conversationId
    );
    
    // Erstelle Summary
    const lastUserMessage = conversation.messages
      .filter((m) => m.role === "user")
      .slice(-1)[0];
    const lastPersonaMessage = conversation.messages
      .filter((m) => m.role === "persona")
      .slice(-1)[0];
    
    const summary: ConversationSummary = {
      ...conversation.metadata,
      preview: lastPersonaMessage?.content?.substring(0, 100) || lastUserMessage?.content?.substring(0, 100) || "",
      lastMessageAt: conversation.metadata.updatedAt,
    };
    
    if (existingIndexEntry !== -1) {
      // Aktualisiere bestehenden Eintrag
      index[existingIndexEntry] = summary;
    } else {
      // Füge neuen Eintrag hinzu
      index.push(summary);
    }
    
    // Sortiere nach updatedAt (neueste zuerst)
    index.sort((a, b) => {
      const dateA = new Date(a.updatedAt).getTime();
      const dateB = new Date(b.updatedAt).getTime();
      return dateB - dateA;
    });
    
    localStorage.setItem(indexKey, JSON.stringify(index));
  } catch (error) {
    console.error("Failed to update conversation index:", error);
  }
}

/**
 * Lädt eine Konversation aus LocalStorage
 */
export function loadConversationFromLocalStorage(conversationId: string): Conversation | null {
  if (typeof window === "undefined") return null;
  
  try {
    const conversationKey = `chat_conversation_${conversationId}`;
    const stored = localStorage.getItem(conversationKey);
    
    if (!stored) return null;
    
    const parsed = JSON.parse(stored) as Omit<Conversation, "metadata"> & {
      metadata: Omit<ConversationMetadata, "createdAt" | "updatedAt"> & {
        createdAt: string;
        updatedAt: string;
      };
    };
    
    // Konvertiere ISO-Strings zurück zu Date-Objekten
    const conversation: Conversation = {
      ...parsed,
      metadata: {
        ...parsed.metadata,
        createdAt: new Date(parsed.metadata.createdAt),
        updatedAt: new Date(parsed.metadata.updatedAt),
      },
    };
    
    // Konvertiere learnings timestamps falls vorhanden
    if (conversation.learnings) {
      conversation.learnings = conversation.learnings.map((learning) => ({
        ...learning,
        timestamp: learning.timestamp instanceof Date ? learning.timestamp : new Date(learning.timestamp),
      }));
    }
    
    return conversation;
  } catch (error) {
    console.error("Failed to load conversation from localStorage:", error);
    return null;
  }
}

/**
 * Lädt alle Konversationen aus LocalStorage
 */
export function loadConversationsFromLocalStorage(
  personaId?: string,
  includeArchived: boolean = false
): ConversationSummary[] {
  if (typeof window === "undefined") return [];
  
  try {
    const indexKey = "chat_conversations_index";
    const stored = localStorage.getItem(indexKey);
    
    if (!stored) return [];
    
    const index = JSON.parse(stored) as Array<
      Omit<ConversationSummary, "createdAt" | "updatedAt" | "lastMessageAt"> & {
        createdAt: string;
        updatedAt: string;
        lastMessageAt?: string;
      }
    >;
    
    // Konvertiere ISO-Strings zurück zu Date-Objekten
    let summaries: ConversationSummary[] = index.map((entry) => ({
      ...entry,
      createdAt: new Date(entry.createdAt),
      updatedAt: new Date(entry.updatedAt),
      lastMessageAt: entry.lastMessageAt ? new Date(entry.lastMessageAt) : undefined,
    }));
    
    // Filter nach Persona
    if (personaId) {
      summaries = summaries.filter((s) => s.personaId === personaId);
    }
    
    // Filter archivierte Chats
    if (!includeArchived) {
      summaries = summaries.filter((s) => !s.isArchived);
    }
    
    // Sortiere nach updatedAt (neueste zuerst)
    summaries.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    
    return summaries;
  } catch (error) {
    console.error("Failed to load conversations from localStorage:", error);
    return [];
  }
}

/**
 * Löscht eine Konversation aus LocalStorage
 */
export function deleteConversationFromLocalStorage(conversationId: string): void {
  if (typeof window === "undefined") return;
  
  try {
    // Lösche komplette Konversation
    const conversationKey = `chat_conversation_${conversationId}`;
    localStorage.removeItem(conversationKey);
    
    // Entferne aus Index
    const indexKey = "chat_conversations_index";
    const stored = localStorage.getItem(indexKey);
    if (stored) {
      const index = JSON.parse(stored) as ConversationSummary[];
      const filtered = index.filter((entry) => entry.conversationId !== conversationId);
      localStorage.setItem(indexKey, JSON.stringify(filtered));
    }
  } catch (error) {
    console.error("Failed to delete conversation from localStorage:", error);
  }
}

/**
 * Archiviert oder de-archiviert eine Konversation
 */
export function archiveConversation(conversationId: string, archived: boolean): void {
  if (typeof window === "undefined") return;
  
  try {
    // Lade Konversation
    const conversation = loadConversationFromLocalStorage(conversationId);
    if (!conversation) return;
    
    // Aktualisiere isArchived Flag
    conversation.metadata.isArchived = archived;
    conversation.metadata.updatedAt = new Date();
    
    // Speichere wieder
    saveConversationToLocalStorage(conversation);
  } catch (error) {
    console.error("Failed to archive conversation:", error);
  }
}

/**
 * Aktualisiert den Titel einer Konversation
 */
export function updateConversationTitle(conversationId: string, title: string): void {
  if (typeof window === "undefined") return;
  
  try {
    // Lade Konversation
    const conversation = loadConversationFromLocalStorage(conversationId);
    if (!conversation) return;
    
    // Aktualisiere Titel
    conversation.metadata.title = title;
    conversation.metadata.updatedAt = new Date();
    
    // Speichere wieder
    saveConversationToLocalStorage(conversation);
  } catch (error) {
    console.error("Failed to update conversation title:", error);
  }
}

/**
 * Generiert eine neue Conversation-ID
 */
export function generateConversationId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Speichert eine Konversation im Backend (vorbereitet, später aktivierbar)
 */
export async function saveConversationToBackend(conversation: Conversation): Promise<void> {
  // TODO: Implementiere Backend-API-Call
  // const response = await fetch("/api/chat-history", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify(conversation),
  // });
  // if (!response.ok) throw new Error("Failed to save conversation");
  console.log("Backend save not yet implemented", conversation);
}

/**
 * Lädt eine Konversation aus dem Backend (vorbereitet, später aktivierbar)
 */
export async function loadConversationFromBackend(conversationId: string): Promise<Conversation | null> {
  // TODO: Implementiere Backend-API-Call
  // const response = await fetch(`/api/chat-history/${conversationId}`);
  // if (!response.ok) return null;
  // return response.json();
  console.log("Backend load not yet implemented", conversationId);
  return null;
}

/**
 * Lädt alle Konversationen aus dem Backend (vorbereitet, später aktivierbar)
 */
export async function loadConversationsFromBackend(
  personaId?: string,
  includeArchived: boolean = false
): Promise<ConversationSummary[]> {
  // TODO: Implementiere Backend-API-Call
  // const params = new URLSearchParams();
  // if (personaId) params.append("personaId", personaId);
  // if (includeArchived) params.append("includeArchived", "true");
  // const response = await fetch(`/api/chat-history?${params.toString()}`);
  // if (!response.ok) return [];
  // const data = await response.json();
  // return data.conversations;
  console.log("Backend load all not yet implemented", personaId, includeArchived);
  return [];
}

/**
 * Löscht eine Konversation im Backend (vorbereitet, später aktivierbar)
 */
export async function deleteConversationFromBackend(conversationId: string): Promise<void> {
  // TODO: Implementiere Backend-API-Call
  // const response = await fetch(`/api/chat-history/${conversationId}`, {
  //   method: "DELETE",
  // });
  // if (!response.ok) throw new Error("Failed to delete conversation");
  console.log("Backend delete not yet implemented", conversationId);
}

/**
 * Archiviert eine Konversation im Backend (vorbereitet, später aktivierbar)
 */
export async function archiveConversationInBackend(
  conversationId: string,
  archived: boolean
): Promise<void> {
  // TODO: Implementiere Backend-API-Call
  // const response = await fetch(`/api/chat-history/${conversationId}/archive`, {
  //   method: "PATCH",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({ archived }),
  // });
  // if (!response.ok) throw new Error("Failed to archive conversation");
  console.log("Backend archive not yet implemented", conversationId, archived);
}

