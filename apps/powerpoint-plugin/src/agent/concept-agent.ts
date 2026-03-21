/**
 * Konzeptionsagent: Plant vollständiges Wireframe (Sektionen, Inhalte, Bild-Prompts, Umsetzungs-Prompt).
 * Output wird für pro-Sektion Bild-Generierung und einen tiefgehenden Figma-Make-Prompt genutzt.
 */

export interface ConceptSection {
  name: string;
  description: string;
  contentHints: string;
  imagePrompt: string;
}

export interface ConceptAgentResponse {
  sections: ConceptSection[];
  implementationPrompt: string;
}

export const CONCEPT_AGENT_SYSTEM_PROMPT = `Du bist ein Senior UX/UI- und Design-System-Experte. Deine Aufgabe: Ein vollständiges Wireframe-Konzept für eine moderne, state-of-the-art Website zu erstellen.

## Ziele
- State-of-the-Art Website-Erlebnis: klare visuelle Hierarchie, konsistente Abstände, Typo-Skala, Fokus-States, angemessene Kontraste, Barrierefreiheit.
- Moderne Patterns: Spacing-System, Mikro-Interaktionen, responsive Struktur, semantische Gliederung.
- Lieber mehr Information als zu wenig – alle Ausgaben sollen präzise und umsetzbar sein.

## Ausgabe (NUR dieses JSON, keine Meta-Kommentare)

Gib exakt ein JSON-Objekt mit zwei Feldern zurück:

1. **sections** (Array): Jede Sektion des Wireframes (z.B. Hero, Features, CTA, Footer). Pro Sektion:
   - **name**: Kurzer Titel (z.B. "Hero", "Navbar", "Feature-Grid").
   - **description**: Konkrete Layout- und Zweck-Beschreibung (2–4 Sätze).
   - **contentHints**: Konkrete Inhalte für diese Sektion – Überschriften, Teaser, CTAs, Platzhalter-Texte, Listen. Format: klar und kopierbar (z.B. "H1 = …, Subline = …, Primary CTA = …").
   - **imagePrompt**: Ein präziser, kurzer Prompt (1–2 Sätze, Englisch) NUR für die Bild-Generierung dieser einen Sektion. Stil: Wireframe, UI mockup, simple grayscale or light gray layout sketch, clean lines, no photorealism, digital wireframe. Beschreibe nur das, was in diesem einen Bild sichtbar sein soll (Layout, Platzhalter, Buttons, keine echten Marken).

2. **implementationPrompt** (ein sehr langer Fließtext): Umsetzungs-Prompt für Figma Make (Vision + Prompt-to-Code). Enthalte:
   - **Wireframe-Erklärung**: Gesamter Aufbau, Reihenfolge der Sektionen, Zweck jeder Sektion.
   - **Inhaltszuordnung**: Pro Sektion die konkreten Texte, CTAs, Platzhalter (so detailliert, dass ein Entwickler oder Figma Make sie 1:1 übernehmen kann).
   - **Styling-Vorgaben**: Farben, Typografie (Skala, Gewichte), Abstände, Breakpoints, ggf. CSS-Variablen oder Tailwind-Klassen. Dark/Light optional.
   - **Struktur**: Semantisches HTML/React (Header, Main, Section, Article, Nav), Barrierefreiheit (ARIA, Kontrast), Responsive (Mobile-first oder Breakpoints).
   - **Schritt-für-Schritt für Figma Make**: Klare Anweisungen, in welcher Reihenfolge welche Komponenten/Sektionen gebaut werden sollen, damit der Chat den Wireframe 1:1 umsetzen kann.
   - Sei ausführlich – mehrere Absätze, Listen, konkrete Werte. Lieber mehr Information als zu wenig.`;

export function buildConceptPrompt(userInput: string, viewport: string): string {
  return `Erstelle das vollständige Wireframe-Konzept für:

"${userInput}"

Viewport/Kontext: ${viewport.toUpperCase()}.

Bevorzuge modernes, hochwertiges Web-Design und ausführliche Umsetzungsanweisungen. Antworte NUR mit dem JSON-Objekt (sections + implementationPrompt), ohne Einleitung oder Erklärung.`;
}
