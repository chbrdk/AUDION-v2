import type { PhaseResponse } from "../app/api/_lib/journeys";

export type Message = {
  id: string;
  role: "user" | "persona" | "system";
  content: string;
  personaName?: string;
  image_ids?: string[];
  images?: string[];
  /** If true, the next completion should compare the first two images (A vs B). */
  ab_compare?: boolean;
  document_ids?: string[];
  /** Filenames for UI when document_ids are present (server text is not stored locally). */
  document_attachment_meta?: Array<{ id: string; filename: string }>;
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
  baseSystemPrompt?: string | null; // Optional: Base system prompt from database
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
  instructions += `- Always stay in character as this persona - never break character or refer to yourself as an AI\n`;
  instructions += `- Respond from the persona's perspective, using their voice, knowledge, and experiences\n`;
  instructions += `- Think and react as this persona would, not as an external observer\n`;
  
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
 * Ersetzt Variablen im Prompt durch tatsächliche Werte aus dem Persona-Profil
 */
function replacePromptVariables(prompt: string, persona: PersonaProfile): string {
  // Erstelle ein Mapping aller verfügbaren Variablen
  const variables: Record<string, string> = {
    // Basis-Informationen
    persona_name: persona.name || persona.fullName || "",
    persona_fullname: persona.fullName || persona.name || "",
    persona_headline: persona.headline || "",
    persona_bio: persona.bio || "",
    persona_age: persona.age?.toString() || "",
    persona_location: persona.location || "",
    persona_gender: persona.gender || "",
    persona_media_affinity: persona.media_affinity?.toString() || "",
    persona_attention_span: persona.attentionSpan || "",
    
    // Arrays als komma-separierte Listen
    persona_interests: persona.interests?.join(", ") || "",
    persona_values: persona.values?.join(", ") || "",
    persona_color_palette: persona.colorPalette?.join(", ") || "",
    persona_social_media_usage: persona.socialMediaUsage?.join(", ") || "",
    
    // Communication Style
    persona_vocabulary: persona.communicationStyle?.vocabulary?.join(", ") || "",
    persona_sentence_structure: persona.communicationStyle?.sentenceStructure || "",
    persona_skepticism_level: persona.communicationStyle?.skepticismLevel?.toString() || "",
    
    // Pain Points
    persona_pain_points: persona.painPoints?.map(p => p.label || "").filter(Boolean).join(", ") || "",
    
    // Goals
    persona_goals: persona.goals?.map(g => g.label || "").filter(Boolean).join(", ") || "",
    
    // Traits
    persona_traits: persona.traits ? Object.entries(persona.traits)
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ") : "",
    existing_traits: persona.traits ? Object.entries(persona.traits)
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ") : "",
  };
  
  // Ersetze alle Variablen im Format ${variable_name}
  let replacedPrompt = prompt;
  const variablePattern = /\$\{([^}]+)\}/g;
  
  // Finde alle Variablen im Prompt
  const foundVariables = [...prompt.matchAll(variablePattern)];
  
  replacedPrompt = replacedPrompt.replace(variablePattern, (match, variableName) => {
    const trimmedName = variableName.trim();
    const normalizedName = trimmedName.toLowerCase();
    
    // Suche nach exakter Übereinstimmung (case-insensitive)
    const exactMatch = Object.entries(variables).find(([key]) => 
      key.toLowerCase() === normalizedName
    );
    
    if (exactMatch) {
      const value = exactMatch[1];
      // Debug für wichtige Variablen
      if (trimmedName.toLowerCase() === "persona_headline" || trimmedName.toLowerCase() === "persona_bio") {
        console.log(`[replacePromptVariables] Replacing ${trimmedName} with:`, value.substring(0, 100));
      }
      return value;
    }
    
    // Versuche mit Unterstrichen statt Bindestrichen
    const altName = normalizedName.replace(/-/g, "_");
    const altMatch = Object.entries(variables).find(([key]) => 
      key.toLowerCase() === altName
    );
    
    if (altMatch) {
      return altMatch[1];
    }
    
    // Debug: Log nicht gefundene Variablen
    console.warn(`[replacePromptVariables] Variable not found: ${trimmedName}`, {
      availableVariables: Object.keys(variables),
      normalizedName,
      altName,
    });
    
    // Wenn nicht gefunden, gib die Variable zurück (nicht ersetzt)
    return match;
  });
  
  return replacedPrompt;
}

/**
 * Baut den adaptiven System-Prompt dynamisch zusammen
 */
export function buildAdaptiveSystemPrompt(context: PromptContext): string {
  const { persona, journeyPhases, conversationHistory, learnings, currentPhase, baseSystemPrompt } = context;
  
  // Wenn ein Base-System-Prompt aus der Datenbank vorhanden ist, verwende ihn als Basis
  let prompt = "";
  
  if (baseSystemPrompt && baseSystemPrompt.trim().length > 0) {
    // Verwende den System-Prompt aus der Datenbank als Basis
    prompt = baseSystemPrompt.trim();
    
    // Ersetze Variablen durch tatsächliche Werte
    const beforeReplace = prompt;
    const variablesInPrompt = beforeReplace.match(/\$\{([^}]+)\}/g) || [];
    prompt = replacePromptVariables(prompt, persona);
    
    // Debug: Log variable replacement (always, not just for Clara)
    console.log("[AdaptivePrompt] Variable replacement:", {
      personaName: persona.name,
      hasVariables: beforeReplace.includes("${"),
      variablesFound: variablesInPrompt,
      beforeReplace: beforeReplace.substring(0, 400),
      afterReplace: prompt.substring(0, 400),
      personaData: {
        name: persona.name,
        headline: persona.headline,
        bio: persona.bio?.substring(0, 100),
        fullName: persona.fullName,
      },
    });
    
    // WICHTIG: Füge explizite Anweisung hinzu, sich in die Persona hineinzuversetzen
    // Dies wird am Anfang hinzugefügt, damit es die höchste Priorität hat
    const personaIdentityInstruction = `You are ${persona.name || persona.fullName || "this persona"}. You must fully embody and act as this persona. Think, speak, and respond exactly as this persona would - not as an AI assistant describing the persona, but AS the persona themselves. Immerse yourself completely in this role and maintain this identity throughout the entire conversation.\n\n`;
    
    prompt = personaIdentityInstruction + prompt;
  } else {
    // Fallback: Baue Prompt dynamisch aus Persona-Profil (alte Logik)
    // WICHTIG: Explizite Anweisung, sich in die Persona hineinzuversetzen
    prompt = `You are ${persona.name || persona.fullName || "this persona"}. You must fully embody and act as this persona. Think, speak, and respond exactly as this persona would - not as an AI assistant describing the persona, but AS the persona themselves. Immerse yourself completely in this role and maintain this identity throughout the entire conversation.\n\n`;
    
    // Basis-Persona-Informationen
    if (persona.bio) {
      prompt += `About you: ${persona.bio}\n\n`;
    }
    
    if (persona.headline) {
      prompt += `Headline: ${persona.headline}\n\n`;
    }
    
    // Demografische Informationen
    const demographics: string[] = [];
    if (persona.age) {
      demographics.push(`Age: ${persona.age}`);
    }
    if (persona.location) {
      demographics.push(`Location: ${persona.location}`);
    }
    if (persona.gender) {
      demographics.push(`Gender: ${persona.gender}`);
    }
    if (demographics.length > 0) {
      prompt += `Demographics: ${demographics.join(", ")}\n\n`;
    }
    
    // Communication Style
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
    
    // Traits (Persönlichkeitsmerkmale)
    if (persona.traits && Object.keys(persona.traits).length > 0) {
      prompt += `Personality traits:\n`;
      Object.entries(persona.traits).forEach(([trait, value]) => {
        prompt += `- ${trait}: ${value}/10\n`;
      });
      prompt += `\n`;
    }
    
    // Pain Points (Frustrationen/Probleme)
    if (persona.painPoints && persona.painPoints.length > 0) {
      prompt += `Pain points and frustrations:\n`;
      persona.painPoints.forEach((pp) => {
        const label = pp.label || "";
        const evidence = pp.evidenceCount ? ` (${pp.evidenceCount} evidence)` : "";
        prompt += `- ${label}${evidence}\n`;
      });
      prompt += `\n`;
    }
    
    // Goals (Ziele)
    if (persona.goals && persona.goals.length > 0) {
      prompt += `Goals and aspirations:\n`;
      persona.goals.forEach((goal) => {
        const label = goal.label || "";
        const priority = goal.priority ? ` (Priority: ${goal.priority})` : "";
        prompt += `- ${label}${priority}\n`;
      });
      prompt += `\n`;
    }
    
    // Interests
    if (persona.interests && persona.interests.length > 0) {
      prompt += `Interests: ${persona.interests.join(", ")}\n\n`;
    }
    
    // Values
    if (persona.values && persona.values.length > 0) {
      prompt += `Values: ${persona.values.join(", ")}\n\n`;
    }
    
    // Media Affinity & Attention Span
    if (persona.media_affinity !== null && persona.media_affinity !== undefined) {
      prompt += `Media affinity: ${persona.media_affinity}/10\n`;
    }
    if (persona.attentionSpan) {
      prompt += `Attention span: ${persona.attentionSpan}\n`;
    }
    if (persona.media_affinity !== null || persona.attentionSpan) {
      prompt += `\n`;
    }
    
    // Social Media Usage
    if (persona.socialMediaUsage && persona.socialMediaUsage.length > 0) {
      prompt += `Social media usage: ${persona.socialMediaUsage.join(", ")}\n\n`;
    }
    
    // Color Palette (Design-Präferenzen)
    if (persona.colorPalette && persona.colorPalette.length > 0) {
      prompt += `Preferred color palette: ${persona.colorPalette.join(", ")}\n\n`;
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
  }
  
  return prompt;
}

