import type { ConversationLearning, Message } from "./adaptive-prompt";

/**
 * Extrahiert Learnings aus Nachrichten
 */
export function extractLearnings(
  messages: Message[],
  personaId?: string
): ConversationLearning[] {
  const learnings: ConversationLearning[] = [];
  
  // Analysiere User-Nachrichten auf Präferenzen
  const userMessages = messages.filter((m) => m.role === "user");
  
  // Pattern-Erkennung für Präferenzen
  const preferencePatterns = [
    { pattern: /(?:i\s+)?(?:prefer|like|love|enjoy)\s+(.+?)(?:\.|$|,)/gi, type: "preference" },
    { pattern: /(?:i\s+)?(?:don'?t\s+like|dislike|hate|don'?t\s+want)\s+(.+?)(?:\.|$|,)/gi, type: "negative_preference" },
    { pattern: /(?:i\s+)?(?:would\s+)?rather\s+(.+?)(?:\.|$|,)/gi, type: "preference" },
    { pattern: /(?:i\s+)?(?:need|want|require)\s+(.+?)(?:\.|$|,)/gi, type: "need" },
  ];
  
  userMessages.forEach((msg) => {
    const content = msg.content;
    let hasExtracted = false;
    
    preferencePatterns.forEach(({ pattern, type }) => {
      const matches = Array.from(content.matchAll(pattern));
      matches.forEach((match) => {
        if (match[1]) {
          const extractedText = match[1].trim();
          if (extractedText.length > 3 && extractedText.length < 200) {
            learnings.push({
              id: `learning-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              personaId,
              topic: type,
              userPreference: extractedText,
              extractedFrom: msg.id,
              timestamp: new Date(),
              confidence: 0.7, // Medium confidence for pattern-based extraction
            });
            hasExtracted = true;
          }
        }
      });
    });
    
    // Extrahiere auch allgemeine Insights aus längeren Nachrichten
    if (content.length > 50 && !hasExtracted) {
      // Suche nach expliziten Statements
      const insightPatterns = [
        /(?:this|that|it)\s+(?:is|was|seems|feels)\s+(.+?)(?:\.|$|,)/gi,
        /(?:i\s+)?(?:think|believe|feel)\s+(?:that\s+)?(.+?)(?:\.|$|,)/gi,
      ];
      
      insightPatterns.forEach((pattern) => {
        const matches = Array.from(content.matchAll(pattern));
        matches.forEach((match) => {
          if (match[1]) {
            const extractedText = match[1].trim();
            if (extractedText.length > 10 && extractedText.length < 150) {
              learnings.push({
                id: `learning-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                personaId,
                topic: "insight",
                personaInsight: extractedText,
                extractedFrom: msg.id,
                timestamp: new Date(),
                confidence: 0.5, // Lower confidence for general insights
              });
            }
          }
        });
      });
    }
  });
  
  // Analysiere Persona-Antworten auf Insights
  const personaMessages = messages.filter((m) => m.role === "persona");
  personaMessages.forEach((msg) => {
    // Extrahiere Insights aus Persona-Antworten, die auf User-Feedback reagieren
    if (msg.content.length > 100) {
      // Suche nach expliziten Erkenntnissen oder Anpassungen
      const insightPattern = /(?:i\s+)?(?:understand|see|realize|notice)\s+(?:that\s+)?(.+?)(?:\.|$|,)/gi;
      const matches = Array.from(msg.content.matchAll(insightPattern));
      matches.forEach((match) => {
        if (match[1]) {
          const extractedText = match[1].trim();
          if (extractedText.length > 10 && extractedText.length < 150) {
            learnings.push({
              id: `learning-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              personaId,
              topic: "persona_insight",
              personaInsight: extractedText,
              extractedFrom: msg.id,
              timestamp: new Date(),
              confidence: 0.6,
            });
          }
        }
      });
    }
  });
  
  return learnings;
}

/**
 * Merged Learnings und vermeidet Duplikate
 */
export function mergeLearnings(
  existing: ConversationLearning[],
  newLearnings: ConversationLearning[]
): ConversationLearning[] {
  const merged = [...existing];
  const seen = new Map<string, ConversationLearning>();
  
  // Indexiere bestehende Learnings
  existing.forEach((learning) => {
    const key = `${learning.topic}-${learning.userPreference || learning.personaInsight || ""}`.toLowerCase();
    if (!seen.has(key) || (seen.get(key)?.confidence || 0) < (learning.confidence || 0)) {
      seen.set(key, learning);
    }
  });
  
  // Füge neue Learnings hinzu oder aktualisiere bestehende
  newLearnings.forEach((learning) => {
    const key = `${learning.topic}-${learning.userPreference || learning.personaInsight || ""}`.toLowerCase();
    const existingLearning = seen.get(key);
    
    if (!existingLearning) {
      // Neues Learning hinzufügen
      merged.push(learning);
      seen.set(key, learning);
    } else if ((learning.confidence || 0) > (existingLearning.confidence || 0)) {
      // Ersetze mit höherer Confidence
      const index = merged.indexOf(existingLearning);
      if (index !== -1) {
        merged[index] = learning;
        seen.set(key, learning);
      }
    }
  });
  
  // Sortiere nach Confidence (höchste zuerst) und dann nach Timestamp
  merged.sort((a, b) => {
    const confidenceDiff = (b.confidence || 0) - (a.confidence || 0);
    if (confidenceDiff !== 0) return confidenceDiff;
    return b.timestamp.getTime() - a.timestamp.getTime();
  });
  
  return merged;
}

/**
 * Speichert Learnings in LocalStorage
 */
export function saveLearningsToLocalStorage(
  personaId: string | "global",
  learnings: ConversationLearning[]
): void {
  if (typeof window === "undefined") return;
  
  try {
    const key = `persona_learnings_${personaId}`;
    const maxLearnings = personaId === "global" ? 50 : 20;
    
    // Behalte nur die relevantesten Learnings
    const learningsToSave = learnings.slice(0, maxLearnings);
    
    // Konvertiere Date-Objekte zu ISO-Strings für JSON
    const serialized = learningsToSave.map((learning) => ({
      ...learning,
      timestamp: learning.timestamp.toISOString(),
    }));
    
    localStorage.setItem(key, JSON.stringify(serialized));
  } catch (error) {
    console.error("Failed to save learnings to localStorage:", error);
  }
}

/**
 * Lädt Learnings aus LocalStorage
 */
export function loadLearningsFromLocalStorage(
  personaId: string | "global"
): ConversationLearning[] {
  if (typeof window === "undefined") return [];
  
  try {
    const key = `persona_learnings_${personaId}`;
    const stored = localStorage.getItem(key);
    
    if (!stored) return [];
    
    const parsed = JSON.parse(stored) as Array<
      Omit<ConversationLearning, "timestamp"> & { timestamp: string }
    >;
    
    // Konvertiere ISO-Strings zurück zu Date-Objekten
    return parsed.map((learning) => ({
      ...learning,
      timestamp: new Date(learning.timestamp),
    }));
  } catch (error) {
    console.error("Failed to load learnings from localStorage:", error);
    return [];
  }
}

/**
 * Löscht Learnings aus LocalStorage
 */
export function clearLearningsFromLocalStorage(personaId?: string): void {
  if (typeof window === "undefined") return;
  
  try {
    if (personaId) {
      const key = `persona_learnings_${personaId}`;
      localStorage.removeItem(key);
    } else {
      // Lösche alle Learnings
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith("persona_learnings_")) {
          localStorage.removeItem(key);
        }
      });
    }
  } catch (error) {
    console.error("Failed to clear learnings from localStorage:", error);
  }
}

/**
 * Speichert Learnings im Backend (vorbereitet, später aktivierbar)
 */
export async function saveLearningsToBackend(
  learnings: ConversationLearning[]
): Promise<void> {
  // TODO: Implementiere Backend-API-Call
  // const response = await fetch("/api/learnings", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify(learnings),
  // });
  // if (!response.ok) throw new Error("Failed to save learnings");
  console.log("Backend save not yet implemented", learnings);
}

/**
 * Lädt Learnings aus dem Backend (vorbereitet, später aktivierbar)
 */
export async function loadLearningsFromBackend(
  personaId?: string
): Promise<ConversationLearning[]> {
  // TODO: Implementiere Backend-API-Call
  // const url = personaId ? `/api/learnings?personaId=${personaId}` : "/api/learnings";
  // const response = await fetch(url);
  // if (!response.ok) throw new Error("Failed to load learnings");
  // return response.json();
  console.log("Backend load not yet implemented", personaId);
  return [];
}

