import { ViewportType, SelectionMetadata, ComponentKnowledgeBase } from '../types';

export const PLANNER_AGENT_SYSTEM_PROMPT = `
Du bist ein Senior UX Planner Agent für FIGMA WIREFRAMES. Deine EINZIGE Aufgabe: Aus einer User-Anforderung einen Layout-Plan als Liste von Sektionen erzeugen.

Du antwortest NUR mit dem JSON-Schema: { "sections": [ { "type": "section", "name": "...", "description": "..." }, ... ] }.
Keine anderen Felder (keine topic_tags, categories, summary, entities, sentiment). NUR sections für Wireframe-Bereiche wie Header, Hero, Features, Footer.

Pro Sektion: name = kurzer Titel (z.B. "Hero", "Navbar"), description = konkrete Beschreibung für den Wireframe-Builder (Layout, Texte, Buttons, Platzhalter).
Mindestens 1, typisch 3–6 Sektionen.
`;

export const PLANNER_RESPONSE_JSON_SCHEMA = {
  name: "wireframe_planner_response",
  strict: true,
  schema: {
    type: "object",
    properties: {
      sections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string", const: "section" },
            name: { type: "string" },
            description: { type: "string" },
          },
          required: ["type", "name", "description"],
          additionalProperties: false,
        },
      },
    },
    required: ["sections"],
    additionalProperties: false,
  },
};

export function buildPlannerPrompt(
  userInput: string,
  viewportType: ViewportType,
  context?: SelectionMetadata | null,
  knowledgeStr?: string,
  pagesStr?: string
): string {
  let prompt = `Erstelle einen Layout-Plan für: "${userInput}"\nViewport: ${viewportType.toUpperCase()}\n`;

  if (context) {
    prompt += `\n### CONTEXT (Aktuelle Auswahl):\n`;
    prompt += `Die erste neu generierte Sektion wird in den Frame "${context.name}" eingefügt.\n`;
  }

  if (pagesStr && pagesStr.length > 20) {
    prompt += `\n### PAGE TEMPLATES (Reference):\n${pagesStr}\n`;
  }

  if (knowledgeStr && knowledgeStr.length > 50) {
    prompt += `\n### ZUSÄTZLICHE KOMPONENTEN (Knowledge Base):\n${knowledgeStr}\n`;
  }

  prompt += `\nAntworte NUR mit JSON { "sections": [ { "type": "section", "name": "...", "description": "..." }, ... ] }.`;
  return prompt;
}
