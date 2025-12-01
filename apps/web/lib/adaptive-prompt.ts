import type { PhaseResponse } from "../app/api/_lib/journeys";

export type Message = {
  id: string;
  role: "user" | "persona" | "system";
  content: string;
  personaName?: string;
};

// PersonaProfile type - matches the structure used in chat page
export type PersonaProfile = {
  name?: string | null;
  fullName?: string | null;
  headline?: string | null;
  bio?: string | null;
  age?: number | null;
  location?: string | null;
  gender?: string | null;
  media_affinity?: number | null;
  interests?: string[];
  colorPalette?: string[];
  attentionSpan?: string | null;
  socialMediaUsage?: string[];
  values?: string[];
  traits?: Record<string, number>;
  painPoints?: Array<{ label?: string; evidenceCount?: number }>;
  goals?: Array<{ label?: string; priority?: number }>;
  communicationStyle?: {
    vocabulary?: string[];
    sentenceStructure?: string;
    skepticismLevel?: number;
  };
};

export type ConversationLearning = {
  id: string;
  personaId?: string; // undefined = global learning
  topic: string;
  userPreference?: string;
  personaInsight?: string;
  extractedFrom: string; // Message-ID oder Kontext
  timestamp: Date;
  confidence?: number; // 0-1, wie sicher sind wir bei diesem Learning
};

export type PromptContext = {
  persona: PersonaProfile;
  journeyPhases?: PhaseResponse[];
  conversationHistory: Message[];
  learnings: ConversationLearning[];
  currentPhase?: PhaseResponse;
  messageCount: number;
};

/**
 * Extrahiert Hauptthemen aus dem Gesprächsverlauf
 */
export function extractTopics(messages: Message[]): string[] {
  const topics: string[] = [];
  const userMessages = messages.filter((m) => m.role === "user");
  
  // Einfache Keyword-basierte Erkennung
  const topicKeywords: Record<string, string[]> = {
    product: ["product", "feature", "functionality", "capability"],
    pricing: ["price", "cost", "pricing", "expensive", "cheap", "affordable"],
    support: ["help", "support", "issue", "problem", "error", "bug"],
    onboarding: ["getting started", "setup", "tutorial", "guide", "onboarding"],
    integration: ["integrate", "api", "connect", "sync", "import"],
  };
  
  const foundTopics = new Set<string>();
  
  userMessages.forEach((msg) => {
    const content = msg.content.toLowerCase();
    Object.entries(topicKeywords).forEach(([topic, keywords]) => {
      if (keywords.some((keyword) => content.includes(keyword))) {
        foundTopics.add(topic);
      }
    });
  });
  
  return Array.from(foundTopics);
}

/**
 * Generiert adaptive Anweisungen basierend auf Gesprächsphase
 */
export function buildAdaptiveInstructions(context: PromptContext): string {
  const { conversationHistory, learnings, currentPhase, messageCount } = context;
  
  let instructions = `Instructions:\n`;
  
  // Wenn das Gespräch gerade beginnt
  if (messageCount < 3) {
    instructions += `- Start with a warm, engaging greeting\n`;
    instructions += `- Ask open-ended questions to understand the user's needs\n`;
    instructions += `- Be conversational and approachable\n`;
  } else if (messageCount < 6) {
    // Mittlere Phase
    instructions += `- Reference previous conversation points naturally\n`;
    instructions += `- Build on established context\n`;
    instructions += `- Deepen the conversation based on what you've learned\n`;
  } else {
    // Fortgeschrittene Phase
    instructions += `- Reference previous conversation points naturally\n`;
    instructions += `- Build on established context\n`;
    instructions += `- Provide detailed, specific responses based on the conversation history\n`;
  }
  
  // Journey-Phase-spezifische Anweisungen
  if (currentPhase) {
    if (currentPhase.description) {
      instructions += `- Current phase goal: ${currentPhase.description}\n`;
    }
    if (currentPhase.expected_emotion) {
      instructions += `- Expected user emotion: ${currentPhase.expected_emotion}\n`;
    }
  }
  
  // Learning-basierte Anweisungen
  if (learnings.length > 0) {
    const userPreferences = learnings.filter((l) => l.userPreference);
    if (userPreferences.length > 0) {
      instructions += `- Adapt your communication style based on user preferences\n`;
      instructions += `- Use insights from previous interactions\n`;
    }
  }
  
  return instructions;
}

/**
 * Baut den adaptiven System-Prompt dynamisch zusammen
 */
export function buildAdaptiveSystemPrompt(context: PromptContext): string {
  const { persona, journeyPhases, conversationHistory, learnings, currentPhase } = context;
  
  let prompt = `You are ${persona.name || persona.fullName || "a persona"}.\n\n`;
  
  // Basis-Persona-Informationen
  if (persona.bio) {
    prompt += `About you: ${persona.bio}\n\n`;
  }
  
  if (persona.headline) {
    prompt += `Headline: ${persona.headline}\n\n`;
  }
  
  if (persona.communicationStyle) {
    prompt += `Communication style:\n`;
    if (persona.communicationStyle.vocabulary && persona.communicationStyle.vocabulary.length > 0) {
      prompt += `- Vocabulary: ${persona.communicationStyle.vocabulary.join(", ")}\n`;
    }
    if (persona.communicationStyle.sentenceStructure) {
      prompt += `- Sentence structure: ${persona.communicationStyle.sentenceStructure}\n`;
    }
    if (persona.communicationStyle.skepticismLevel !== undefined) {
      prompt += `- Skepticism level: ${persona.communicationStyle.skepticismLevel}/10\n`;
    }
    prompt += `\n`;
  }
  
  if (persona.interests && persona.interests.length > 0) {
    prompt += `Interests: ${persona.interests.join(", ")}\n\n`;
  }
  
  if (persona.values && persona.values.length > 0) {
    prompt += `Values: ${persona.values.join(", ")}\n\n`;
  }
  
  // Journey-Kontext (wenn vorhanden)
  if (currentPhase) {
    prompt += `Current conversation phase: ${currentPhase.name}\n`;
    if (currentPhase.description) {
      prompt += `Phase goal: ${currentPhase.description}\n`;
    }
    if (currentPhase.expected_emotion) {
      prompt += `Expected emotion: ${currentPhase.expected_emotion}\n`;
    }
    prompt += `\n`;
  } else if (journeyPhases && journeyPhases.length > 0) {
    prompt += `Available journey phases: ${journeyPhases.map((p) => p.name).join(", ")}\n\n`;
  }
  
  // Learnings aus vorherigen Gesprächen
  if (learnings.length > 0) {
    prompt += `Conversation insights:\n`;
    learnings.forEach((learning) => {
      if (learning.userPreference) {
        prompt += `- User prefers: ${learning.userPreference}\n`;
      }
      if (learning.personaInsight) {
        prompt += `- Insight: ${learning.personaInsight}\n`;
      }
    });
    prompt += `\n`;
  }
  
  // Gesprächsverlauf-Analyse (letzte N Nachrichten)
  if (conversationHistory.length > 0) {
    const topics = extractTopics(conversationHistory);
    if (topics.length > 0) {
      prompt += `Recent conversation topics: ${topics.join(", ")}\n\n`;
    }
  }
  
  // Adaptive Anweisungen
  prompt += buildAdaptiveInstructions(context);
  
  return prompt;
}

