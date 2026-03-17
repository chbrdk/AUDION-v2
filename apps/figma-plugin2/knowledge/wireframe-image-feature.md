# Wireframe als Bild (GPT Image 1.5)

## Ablauf

1. **UI**: User wählt Bildformat (Hochformat 1024×1536, Querformat 1536×1024, Quadrat 1024×1024), gibt Beschreibung ein und klickt „Wireframe als Bild (GPT Image 1.5)“.
2. **Message**: `generate-wireframe-image` mit `prompt`, `apiKey`, `size` an Plugin-Code.
3. **OpenAI Images API**: `POST https://api.openai.com/v1/images/generations`
   - Model: `gpt-image-1.5`
   - Quality: `low`
   - Size: `1024x1536` (Standard für Landingpage), `1536x1024` oder `1024x1024`
   - Prompt mit Wireframe-Stil-Prefix; `response_format: 'b64_json'`.
4. **Figma**: Base64 → `Uint8Array` → `figma.createImage(bytes)` → Frame in gewählter Größe mit Image-Fill → an aktuelle Page anhängen, auswählen, in Viewport zoomen.
5. **Feedback**: `wireframe-image-generated` oder `wireframe-image-error` an UI; Figma-Toast.

## Relevante Dateien

- `code.ts`: Case `generate-wireframe-image`, OpenAI fetch, createImage, Frame erstellen.
- `AgentPanel.tsx`: Button „Wireframe als Bild“, Props `onGenerateWireframeImage`, `isGeneratingWireframeImage`.
- `ui.tsx`: `handleGenerateWireframeImage`, State `isGeneratingWireframeImage`, Message-Handler für `wireframe-image-*`.

## Konzeptionsprompt (Wireframe + Figma Make)

Separater Button **„Konzeptionsprompt (Wireframe + Figma Make)“** im Agent-Panel:
- Nutzt dieselbe Beschreibung wie Wireframe/Wireframe-Bild.
- Ein LLM-Aufruf (Chat Completions, gpt-4o-mini) erzeugt einen langen Fließtext mit:
  1. **Wireframe-Erklärung & Inhalt**: Aufbau, Sektionen, konkrete Inhalte (Überschriften, CTAs, Platzhalter).
  2. **Anweisungen für Figma Make**: Prompt-to-Code/Vision-Anweisungen, Styling (Farben, Typo, Abstände), Struktur (HTML/React, A11y, Responsive), so dass der Text 1:1 in den Figma-Make-Chat eingefügt werden kann.
- Ergebnis wird unter dem Button in einer Textarea angezeigt; **Kopieren** schreibt den Text in die Zwischenablage.
- Message: `generate-concept-prompt` (prompt, apiKey, viewport) → `concept-prompt-generated` / `concept-prompt-error`.

## Konzeptionsagent: Wireframe konzipieren & als Bilder (pro Sektion)

Ein **Konzeptionsagent** plant das komplette Wireframe, generiert pro Sektion ein Bild (GPT Image 1.5), baut die Bilder in Figma untereinander zusammen und liefert einen **langen Umsetzungs-Prompt** für Figma Make.

### Ablauf

1. **UI**: Button „Wireframe konzipieren & als Bilder (pro Sektion)“; nutzt dasselbe Prompt- und Bildformat-Dropdown wie „Wireframe als Bild“.
2. **Message**: `generate-wireframe-concept` mit `prompt`, `apiKey`, `viewport`, `imageSize` (optional).
3. **Konzeptionsagent** (Chat Completions, gpt-4o-mini, `response_format: json_object`, max_tokens 8192):
   - System-Prompt: Senior UX/UI-Experte, State-of-the-Art Design, Barrierefreiheit, ausführliche Umsetzungsanweisungen.
   - Ausgabe: `sections` (Array mit `name`, `description`, `contentHints`, `imagePrompt` pro Sektion) und `implementationPrompt` (sehr langer Fließtext für Figma Make).
4. **Pro Sektion**: Images API mit `section.imagePrompt` (+ Wireframe-Stil-Prefix), Base64 → Frame mit Image-Fill, Name „Sektion: {name}“, in Array sammeln.
5. **Figma**: Parent-Frame mit Auto-Layout (VERTICAL, itemSpacing 0), alle Sektion-Frames anhängen, an Page, Selection, scrollAndZoomIntoView.
6. **Feedback**: `concept-assembly-done` mit `implementationPrompt` und `sectionCount`; bei Fehler `concept-assembly-error` mit `error`.

### Message-Typen

- **generate-wireframe-concept**: Startet den Flow (prompt, apiKey, viewport?, imageSize?).
- **concept-assembly-done**: Erfolg; Payload: `implementationPrompt` (string), `sectionCount` (number).
- **concept-assembly-error**: Fehler; Payload: `error` (string).
- **generation-progress**: Zwischenstände (z. B. „Konzept wird erstellt…“, „Sektion 2/5: Bild wird generiert…“).

### Bedeutung von `sections` und `implementationPrompt`

- **sections**: Jede Sektion hat einen kurzen **imagePrompt** nur für die Bild-Generierung dieser einen Sektion (Wireframe-Stil, grau/skizzenhaft). `contentHints` enthält konkrete Texte/CTAs/Platzhalter für die spätere Umsetzung.
- **implementationPrompt**: Bewusst **lang und detailliert** – lieber mehr Information als zu wenig. Enthält: Gesamter Wireframe-Aufbau, Inhaltszuordnung pro Sektion, Styling-Vorgaben (Farben, Typo, Abstände, Breakpoints), Schritt-für-Schritt-Anweisungen für Figma Make (Reihenfolge, Komponenten, Struktur, A11y, Responsive).

### Relevante Dateien

- `src/agent/concept-agent.ts`: `CONCEPT_AGENT_SYSTEM_PROMPT`, `buildConceptPrompt`, Typen `ConceptSection`, `ConceptAgentResponse`.
- `code.ts`: Case `generate-wireframe-concept` (Konzept-Call → Loop Bild-Generierung → Parent-Frame + Auto-Layout → PostMessage).
- `AgentPanel.tsx`: Button, Props `onGenerateWireframeConcept`, `isGeneratingConceptAssembly`, `conceptAssemblyResult`; Anzeige Umsetzungs-Prompt + Kopieren.
- `ui.tsx`: `handleGenerateWireframeConcept`, State `isGeneratingConceptAssembly`, `conceptAssemblyResult`, Message-Handler für `concept-assembly-done` / `concept-assembly-error`.

## API-Referenz

- OpenAI Images: https://platform.openai.com/docs/api-reference/images/create
- Figma: `figma.createImage(data: Uint8Array)`, Frame/Rect mit `fills: ImagePaint` (imageHash, scaleMode: 'FILL').
- Figma Make: https://developers.figma.com/docs/code/intro-to-figma-make/
