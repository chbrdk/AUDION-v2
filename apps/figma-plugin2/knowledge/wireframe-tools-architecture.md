# Wireframe Generator: Tool-Based Architecture (Konzept 2026)

## 1. Research: Figma Plugin API – Stand 2026

### 1.1 Plugin API vs. REST API

| | **Plugin API** | **REST API** |
|---|----------------|--------------|
| **Kontext** | Läuft im Editor (Figma/FigJam/Dev/Slides/Buzz), nutzergetrieben | Server-seitig, ohne geöffnetes File |
| **Zugriff** | **Lesen + Schreiben** auf File-Inhalt (Layers, Eigenschaften, Hierarchie) | **Nur Lesen** (File-JSON, Kommentare, Versionen, Teams) |
| **Für Wireframe** | ✅ Erzeugen von Frames, Rechtecken, Text, Bildern, Anhängen an Page | ❌ Kein Erzeugen/Ändern von Nodes |

**Fazit:** Der Wireframe-Generator bleibt auf der **Plugin API** (JavaScript im Plugin, `figma`-Objekt). Die REST API ist für Export/Import oder Metadaten relevant, nicht für das Zeichnen im Canvas.

### 1.2 Relevante Figma-Plugin-API-Fakten (developers.figma.com)

- **API-Version:** `apiVersion: '1.0.0'` (im Manifest festgelegt).
- **Node-Typen:** Nur bestimmte Nodes können **Kinder** haben (`ChildrenMixin`): z. B. `FrameNode`, `PageNode`, `GroupNode`, `ComponentNode`, `InstanceNode`. **RectangleNode, EllipseNode, LineNode, TextNode** haben **keine** `appendChild`-Methode – sie dürfen nie als Parent in einer Hierarchie verwendet werden.
- **Erzeugung (figma.):**
  - `figma.createFrame()` → FrameNode (Container, Layout möglich)
  - `figma.createRectangle()` → RectangleNode
  - `figma.createEllipse()` → EllipseNode
  - `figma.createLine()` → LineNode
  - `figma.createText()` → TextNode (vorher `figma.loadFontAsync(fontName)` nötig)
  - **Kein** `createGroup()` – stattdessen `figma.group(nodes, parent, index?)` → GroupNode
- **Hierarchie:** `parent.appendChild(child)` nur, wenn `parent` ein Node mit `ChildrenMixin` ist (Frame, Page, Group, …). Neue Nodes werden standardmäßig unter `figma.currentPage` erzeugt, wenn kein Parent übergeben wird.
- **Fetch:** Im Plugin ist `fetch` verfügbar; **nur** `method`, `headers`, `body` werden unterstützt (kein `signal`/AbortController für Timeouts – Timeouts via `Promise.race`).

Diese Regeln begründen, warum ein „Figma-Executor“, der rohe Befehle ausgibt, leicht Fehler wie „parent btn_rect not a container“ erzeugt: Der Agent muss wissen, dass **nur Frames (oder Groups)** als Parent für appendChild infrage kommen.

---

## 2. Aktuelle Architektur: Agent mit Figma-Tools (alleiniger Modus)

**UI:** Tab **„Experimental“** öffnet eine Auswahlseite; dort führt der Button **„LLM Designer“** auf eine eigene Unterseite mit Wireframe-Generierung (Prompt, Viewport, Modell, Wissen, „Wireframe generieren“). Chat und Journeys enthalten keine Agent-/Wireframe-Funktionen.

Der Plugin nutzt **nur** den tool-basierten Agenten für „Insert Wireframe“:

- **createStage** erzeugt die Bühne (id `"stage"`); **runWireframeToolAgent** sendet den User-Prompt an OpenAI mit Tools (createSection, createRow, addText, createButton, createHeader, createHero, …).
- Der Agent ruft Tools in einer Schleife auf; **executeTool** führt jeden Aufruf in der Figma-Plugin-API aus und liefert zurück (z. B. sectionId, rowId).
- Kein Director/Designer/Executor mehr; keine runCommands-Befehlsliste.

(Die frühere Variante mit Director → Designer → Figma Executor → runCommands wurde entfernt.)

---

## 3. Agent mit Figma-Tools (Details)

### 3.1 Grundidee

- **Ein (oder mehrere) Agent(en)** entscheiden, **welche Aktion** als Nächstes ausgeführt wird.
- Statt eine lange Befehlsliste zu generieren, ruft der Agent **Tools** auf (OpenAI Function Calling / Tool Use).
- Jedes Tool entspricht einer **fest definierten, korrekten** Operation in der Figma Plugin API („Recipe“). Das **Wissen** steckt in der **Tool-Implementierung** und in der **Tool-Beschreibung** für das Modell.

### 3.2 Vorteile

1. **Keine ungültigen Hierarchien:** z. B. Tool `createButton(parentId, label, variant)` erzeugt intern immer: Frame als Container → Rechteck + Text als Kinder → appendChild nur an den Frame. Der Agent übergibt nur `parentId` (muss ein Frame sein) und bekommt die neue Node-ID zurück.
2. **Reaktion auf Rückgaben:** Agent erhält z. B. `{ "sectionId": "sec_1" }` und kann beim nächsten Aufruf `createCard(sectionId, ...)` verwenden.
3. **Weniger Token/Latenz pro „logischer“ Aktion:** Ein Tool „createCard“ kann 5–10 Figma-API-Schritte kapseln; das Modell macht einen Tool-Call statt 10 Zeilen JSON.
4. **Skalierbarkeit:** Neue Patterns (z. B. „So baut ihr immer einen Header“) = neues Tool + Beschreibung; bestehende Prompts bleiben stabil.
5. **Testbarkeit:** Jedes Tool einzeln unit-testbar; Agent-Verhalten über Tool-Schemas und Beispiele steuerbar.

### 3.3 Ablauf (High-Level)

1. User gibt Prompt ein (z. B. „Landingpage mit Hero, zwei Bild-Panels, Footer“).
2. Optional: **Director/Planner** (wie bisher) liefert Sektionen; dann pro Sektion oder für die ganze Seite:
3. **Tool-calling-Agent** (ein LLM-Aufruf mit `tools: [ ... ]`):
   - Bekommt Kontext: aktuelle Sektion, verfügbare Parent-IDs (z. B. `root` = aktueller Section-Frame), Viewport.
   - Wählt ein Tool (z. B. `createSection`, `createButton`, `addText`, `addPlaceholderImage`) und Argumente.
4. **Plugin** führt das Tool aus (ruft Figma API auf), erhält neue Node-IDs.
5. **Plugin** sendet Tool-Ergebnis zurück an das Modell (z. B. `{ "success": true, "nodeId": "btn_1", "parentId": "sec_1" }`).
6. Wiederhole 3–5, bis der Agent keine weiteren Tool-Calls mehr macht (oder Max-Iterationen / Timeout).

Alle „Recipes“ (wie man einen Button baut, wie man Text hinzufügt, wie ein Platzhalter-Bild aussieht) sind im **Plugin-Code** und in den **Tool-Beschreibungen** (JSON-Schema + description) festgelegt – kein Training nötig, nur klare Dokumentation für das Modell.

---

## 4. Tool-Definitionen („Knowledge“ als Tools)

Jedes Tool ist eine Funktion mit fester Signatur und fester Implementierung. Die Beschreibung für die OpenAI API sagt dem Agent, wann und wie er das Tool nutzen soll.

### 4.1 Konventionen

- **parentId:** Immer die ID eines **Frames** (oder der Page), unter dem das neue Element eingefügt wird. Das Plugin kann intern eine Map `id → Node` führen (vom Agent vergebene IDs, z. B. `section_1`, `card_2`).
- **Rückgabe:** Jedes Tool gibt mindestens `success` und eine **nodeId** (oder mehrere) zurück, die der Agent als parentId für weitere Calls nutzen kann.
- **Koordinaten/Layout:** Entweder Tools übernehmen sinnvolle Defaults (z. B. Auto-Layout im Section-Frame) oder nehmen optionale `x`, `y`, `width`, `height` entgegen.

### 4.2 Vorschlag: Minimale Tool-Set (Wireframe-Primitive)

| Tool | Beschreibung (für Agent) | Parameter (Beispiel) | Rückgabe | Recipe (Kern) |
|------|---------------------------|----------------------|----------|----------------|
| **createSection** | Erstellt einen neuen Section-Container (Frame) für die aktuelle Seite. Immer als oberste Einheit für eine Sektion nutzen. | `name`, `direction?: 'vertical'\|'horizontal'`, `gap?: number`, `padding?: number` | `{ sectionId }` | createFrame, layoutMode VERTICAL/HORIZONTAL, itemSpacing, padding; auf currentPage appendChild; ID vergeben (z. B. section_1). |
| **createButton** | Erstellt einen Button (Frame mit Hintergrund-Rechteck + Text-Label). parentId muss ein Frame sein. | `parentId`, `label`, `variant?: 'primary'\|'secondary'\|'outline'`, `width?: number` | `{ buttonId }` | createFrame (Button-Container) → createRectangle (Hintergrund) + createText (Label) → loadFontAsync → appendChild an Frame; Frame-ID zurück. |
| **addText** | Fügt einen Textblock in einen bestehenden Frame ein. | `parentId`, `content`, `variant?: 'h1'\|'h2'\|'h3'\|'body'\|'small'`, `align?: 'left'\|'center'\|'right'` | `{ textId }` | loadFontAsync (je variant) → createText → appendChild(parentId). |
| **addPlaceholderImage** | Fügt einen Bild-Platzhalter (Rechteck mit optionalem Label-Text) ein. | `parentId`, `width`, `height`, `label?: string` | `{ placeholderId }` | createFrame (optional für Label) oder nur createRectangle; ggf. createText für Label; appendChild an parentId. |
| **createCard** | Erstellt eine Karte (Frame mit optionalem Bild-Platzhalter, Titel, Beschreibung, CTA-Button). | `parentId`, `title`, `description?: string`, `buttonLabel?: string`, `placeholderHeight?: number` | `{ cardId }` | createFrame (Card) → addPlaceholderImage (intern) + addText (Titel) + addText (Description) + createButton (CTA); cardId = Frame. |
| **appendToPage** | Hängt einen bestehenden Node (per nodeId) an die aktuelle Page an. Für Root-Section. | `nodeId` | `{ success }` | currentPage.appendChild(nodeMap.get(nodeId)). |

Zusätzlich umgesetzt (Forms, Tabellen, UI-Primitive):

- **createDivider**, **createAvatar**, **createBadge**, **createSpacer** – siehe `knowledge/figma-tool-recipes.md`.
- **createInput**, **createForm** – Formularfelder und Form-Container (z. B. Login, Kontakt).
- **createTable** – Daten-Grid mit Header und Zellen (max. 10×20).
- **setLayout** – Mutator: bestehenden Frame (nodeId) anpassen (layoutMode, itemSpacing, padding, Align). **createSection/createRow** mit optional **align** (min | center | max).
- **createCheckbox**, **createRadio**, **createTextarea** – Form-Optionen und mehrzeiliges Feld. **createList** – Aufzählungen (bullet, numbered, plain).
- **createHeader**, **createHero** – optionale Blöcke: Header (Logo + Nav + CTA), Hero (Titel + Subtitle + Bild + CTA). **groupNodes** – Atom: bestehende Nodes mit `figma.group(nodes, parent)` gruppieren.
- **addSvg**, **createIconButton** – Icons/Vector aus SVG-Code: addSvg(parentId, svgCode) nutzt `figma.createNodeFromSvg`; createIconButton für Icon-Only- oder Icon+Label-Buttons.

Details und Recipes: `knowledge/figma-tool-recipes.md`.

### 4.3 „Knowledge“ explizit dokumentieren

In der Codebasis (z. B. `knowledge/figma-tool-recipes.md`) kann pro Tool festgehalten werden:

- **Button:** Immer Frame als Container; Rechteck (cornerRadius 8, fills je variant) + Text; Frame layoutMode HORIZONTAL, padding 12/16.
- **Text:** Immer vorher loadFontAsync für die gewählte variant (h1=24px Bold, body=14px Regular, …); textAutoResize HEIGHT.
- **Placeholder-Bild:** Rechteck mit fill #E0E0E0; wenn label, dann kleines createText darunter im gleichen Frame.

So bleibt das Verhalten reproduzierbar und bei API-Änderungen an einer Stelle anpassbar.

---

## 5. Technische Integration

### 5.1 OpenAI API

- **Chat Completions API** mit `tools: [ { type: "function", function: { name, description, parameters } } ]`.
- Bei jeder Antwort: `choices[0].message.tool_calls` prüfen; für jeden Eintrag die Funktion im Plugin ausführen, Ergebnis als `tool`-Message zurückgeben; erneuter Request mit erweitertem `messages`-Array (bis keine tool_calls mehr oder Max-Steps).

### 5.2 Plugin-Seite

- **Main-Thread (code.ts):** Führt nur aus, was die Figma API betrifft (createFrame, createRectangle, …). Entweder:
  - **Variante A:** UI/Worker sendet Tool-Call (Name + Argumente) an Main-Thread; Main-Thread führt eine feste Funktion (z. B. `executeTool(name, args)`) aus, gibt Ergebnis (nodeId, success, error) zurück.
  - **Variante B:** Tool-Execution bleibt im Main-Thread; der „Agent-Loop“ (HTTP zu OpenAI, Parsen von tool_calls) läuft im Main-Thread (wie bisher mit fetch), ruft nach jedem tool_call die lokale `executeTool` auf.
- **ID-Map:** Main-Thread hält eine Map `agentId → SceneNode` (z. B. `section_1` → FrameNode). Bei createSection/createButton/… wird eine neue ID vergeben und die Map aktualisiert; bei appendChild(parentId, childId) wird über die Map der echte Node geholt.

### 5.3 Timeouts und Grenzen

- Pro Tool-Call-Runde: z. B. 30–45s Timeout für den HTTP-Request.
- Max. Tool-Call-Iterationen pro Sektion (z. B. 15), um Endlosschleifen zu vermeiden.
- Kein `signal` in fetch (Figma-Plugin); weiterhin `Promise.race` für Timeout.

### 5.4 Coexistenz mit aktuellem Flow

- **Option A:** Neuer Modus „Wireframe (Tools)“ neben „Director → Designer → Figma“ und „Schnell (1 Call)“; User wählt im UI.
- **Option B:** Schrittweise Migration: Zuerst nur eine Sektion mit Tools bauen; bei Erfolg Director beibehalten, aber pro Sektion den Tool-Agent statt Design-Spec + Figma-Executor aufrufen.

---

## 6. Umsetzung (Stand)

1. **Tool-Schemas** – in `src/agent/wireframe-tool-agent.ts`: `FIGMA_WIREFRAME_TOOLS` (createSection, addText, createButton) als OpenAI-Format.
2. **executeTool** – in `src/agent/execute-tool.ts`: ruft createSection, createButton, addText aus figma-molecules auf; nodeMap im Kontext.
3. **Agent-Loop** – in `src/agent/wireframe-tool-agent.ts`: `runWireframeToolAgent()` sendet Chat Completions mit `tools`, bei `tool_calls` → executeTool pro Call → Tool-Ergebnis an messages → wiederholen bis keine tool_calls oder maxSteps (15). In code.ts Modus **„Agent (Tools)“** ruft das ohne Director/Knowledge auf.
4. **Dokumentation:** `knowledge/figma-tool-recipes.md` – Recipes für createButton, createSection, addText.
5. **Tests:** figma-atoms, figma-molecules, execute-tool, wireframe-tool-agent (Schemas + Fehlerpfad bei nicht-ok Response).

---

## 7. Referenzen

- Figma Plugin API (figma-Objekt): https://developers.figma.com/docs/plugins/api/figma/
- Node Types / ChildrenMixin: https://developers.figma.com/docs/plugins/api/nodes/
- OpenAI Function Calling: https://platform.openai.com/docs/guides/function-calling
- Bestehende Befehlsliste: `knowledge/figma-wireframe-commands.md`, `src/agent/command-interpreter.ts`
