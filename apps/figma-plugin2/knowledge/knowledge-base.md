# Knowledge Base, Page Scan, and Insert Wireframe

## Overview

The plugin maintains a **knowledge base** of indexed **components** and **pages** (templates). The main actions are:

- **Add components to knowledge** — scan the current selection for Figma components/instances and add them to the knowledge base (with optional AI enrichment: tags, styleCategory, usageNotes).
- **Add page to knowledge** — scan a single selected Frame or Group as a full page/template, extracting its structure (sections) and which components it uses.
- **Insert wireframe** — generate a wireframe from the user's prompt and insert it on the canvas, using only **relevant** components and pages from the knowledge base (retrieval), so it scales to 100+ components.

## Knowledge Base Shape

Stored under `clientStorage` key `audion-knowledge-base`. Normalized shape:

- **components**: `ScannedComponent[]` — id, name, description, documentation, visualBlueprint, variants, properties; optional tags, styleCategory, usageNotes.
- **pages**: `ScannedPage[]` — id, name, description?, pageType? (landing | dashboard | article | generic), structure (ordered sections with name, componentIds?, childNames?), componentRefs, blueprintSummary.
- **lastUpdated**: number.

Old stored objects without `pages` are normalized at load time with `pages: []`.

## Scan Actions

### Add components to knowledge

- **Message**: `scan-components` (no payload).
- **Backend**: Runs `scanSelectedComponents()` on current selection, optionally enriches with AI, merges into existing knowledge (preserving existing `pages`), saves, posts `knowledge-loaded`.
- **UI**: Button "Add components to knowledge"; optional loading state `isScanningComponents`.

### Add page to knowledge

- **Message**: `scan-page` (no payload).
- **Backend**: Runs `scanSelectedPage()`. Selection must be exactly one Frame or Group. Extracts structure (child sections, component instances), builds `ScannedPage` with blueprintSummary (section names joined), infers pageType from name/description. Merges into `knowledge.pages`, saves, posts `knowledge-loaded`.
- **UI**: Button "Add page to knowledge"; optional loading state `isScanningPage`. If selection is invalid, user sees: "Select a single frame or group that represents a full page."

## Insert Wireframe (Agent Tools only)

- **Message**: `generate-wireframe` (prompt, viewport, model, apiKey). No mode parameter; the plugin uses only the **Agent (Tools)** flow.
- **Flow**:
  1. Load knowledge (normalized) for context; create a root frame with id `"stage"` (viewport-based size).
  2. Run **Wireframe Tool Agent** (`runWireframeToolAgent`): OpenAI with tools (createSection, createRow, addText, createButton, createHeader, createHero, etc.). The agent calls tools in a loop until the wireframe is complete or max steps.
  3. Results are applied via `executeTool`; all created nodes are stored in a nodeMap and appended under the stage.
- **Documentation**: Best practices and tool recipes: [wireframe-tool-best-practices.md](wireframe-tool-best-practices.md), [figma-tool-recipes.md](figma-tool-recipes.md), [wireframe-tools-architecture.md](wireframe-tools-architecture.md).

## Export / Import

- **Export**: Serializes full `knowledgeBase` (components + pages) to JSON. File includes `pages` array.
- **Import**: Parses JSON; validates `components` array; normalizes with `pages: imported.pages ?? []` so old exports without pages still work. Sends `save-knowledge` with normalized object.

## Tool-basierter Agent (aktuell)

Der **Wireframe Tool Agent** nutzt OpenAI Function Calling: Tools (createSection, createButton, addText, createHeader, createHero, createCard, …) werden in einer Schleife aufgerufen; `executeTool` führt die Aufrufe in Figma aus. Architektur und Tool-Liste: **`knowledge/wireframe-tools-architecture.md`**, Rezepte: **`knowledge/figma-tool-recipes.md`**, Best Practices: **`knowledge/wireframe-tool-best-practices.md`**.

## Relevant Files

- **Types**: `src/types/index.ts` — ScannedPage, ScannedPageSection, ComponentKnowledgeBase (components, pages, lastUpdated).
- **Page scan**: `src/agent/page-scanner.ts` — scanSelectedPage().
- **Component scan**: `src/agent/scanner.ts` — scanSelectedComponents().
- **Backend**: `src/code.ts` — normalizeKnowledge, case `scan-page`, case `generate-wireframe` (createStage + runWireframeToolAgent), case `get-knowledge` / `save-knowledge` / `scan-components` (merge with pages).
- **UI**: `src/components/AgentPanel.tsx` — Knowledge base title with counts, list components and pages (with remove), "Add components to knowledge", "Add page to knowledge", "Insert wireframe" button; `src/ui.tsx` — onScanPage, isScanningComponents, isScanningPage, knowledge-loaded normalizes and clears scanning flags, import normalizes pages.
