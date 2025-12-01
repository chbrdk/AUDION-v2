import type { PhaseResponse, JourneyResponse } from "../app/api/_lib/journeys";
import type { Message } from "./adaptive-prompt";

/**
 * Erkennt die aktuelle Phase basierend auf Keywords in der Nachricht
 */
export function detectPhaseByKeywords(
  message: string,
  phases: PhaseResponse[]
): PhaseResponse | undefined {
  if (!phases || phases.length === 0) return undefined;
  
  const messageLower = message.toLowerCase();
  let bestMatch: PhaseResponse | undefined;
  let bestScore = 0;
  
  phases.forEach((phase) => {
    let score = 0;
    
    // Suche nach Phase-Namen
    const phaseNameWords = phase.name.toLowerCase().split(/\s+/);
    phaseNameWords.forEach((word) => {
      if (word.length > 3 && messageLower.includes(word)) {
        score += 2;
      }
    });
    
    // Suche nach Phase-Beschreibung
    if (phase.description) {
      const descWords = phase.description.toLowerCase().split(/\s+/);
      descWords.forEach((word) => {
        if (word.length > 4 && messageLower.includes(word)) {
          score += 1;
        }
      });
    }
    
    // Suche nach Phase-Elementen (Moments)
    if (phase.elements && phase.elements.length > 0) {
      phase.elements.forEach((element) => {
        if (element.content) {
          const contentWords = element.content.toLowerCase().split(/\s+/);
          contentWords.forEach((word) => {
            if (word.length > 4 && messageLower.includes(word)) {
              score += 0.5;
            }
          });
        }
      });
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = phase;
    }
  });
  
  // Nur zurückgeben, wenn Score hoch genug ist
  return bestScore >= 2 ? bestMatch : undefined;
}

/**
 * Erkennt die aktuelle Phase basierend auf Gesprächsverlauf
 */
export function getCurrentPhase(
  messages: Message[],
  journey?: JourneyResponse
): PhaseResponse | undefined {
  if (!journey || !journey.phases || journey.phases.length === 0) {
    return undefined;
  }
  
  const sortedPhases = [...journey.phases].sort(
    (a, b) => (a.phase_order || 0) - (b.phase_order || 0)
  );
  
  // Heuristik 1: Keyword-basierte Erkennung aus letzten Nachrichten
  const recentMessages = messages.slice(-5); // Letzte 5 Nachrichten
  for (const msg of recentMessages.reverse()) {
    // Prüfe User-Nachrichten zuerst
    if (msg.role === "user") {
      const phaseMatch = detectPhaseByKeywords(msg.content, sortedPhases);
      if (phaseMatch) {
        return phaseMatch;
      }
    }
  }
  
  // Heuristik 2: Nachrichtenanzahl-basierte Erkennung
  const userMessageCount = messages.filter((m) => m.role === "user").length;
  
  // Berechne Phase basierend auf Nachrichtenanzahl
  // Annahme: ~3-4 Nachrichten pro Phase
  const messagesPerPhase = 3.5;
  const estimatedPhaseIndex = Math.floor(userMessageCount / messagesPerPhase);
  
  if (estimatedPhaseIndex < sortedPhases.length) {
    return sortedPhases[estimatedPhaseIndex];
  }
  
  // Fallback: Letzte Phase
  return sortedPhases[sortedPhases.length - 1];
}

