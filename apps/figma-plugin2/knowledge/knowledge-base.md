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

## Insert Wireframe (with retrieval)

- **Message**: `generate-wireframe` (prompt, viewport, model, apiKey, mode).
- **Modes**:
  - **Director → Designer → Figma** (default, `mode: 'styled'`): Director (Planner) → sections → per section: Designer (Design Spec) → Figma Agent (Executor) → runCommands. Small calls, 45s timeout per section. See `knowledge/wireframe-agents.md`.
  - **Schnell (1 Call)** (`mode: 'fast'`): Single Figma Executor call for all commands; 90s timeout.
- **Flow** (shared start):
  1. Load knowledge (normalized).
  2. **Retrieval**: If total (components + pages) > 15, a first LLM call ("retrieval helper") returns `componentIds` and `pageIds`. Build `knowledgeStr` and `pagesStr` only for selected items.
  3. **Director mode**: Director (Planner) with `buildPlannerPrompt(..., knowledgeStr, pagesStr)` → sections. For each section: Designer (Design Spec, 45s timeout) → Figma Executor (45s timeout) → runCommands.
  4. **Fast mode**: Single Figma Executor call with prompt + knowledge snippet, then runCommands.

## Export / Import

- **Export**: Serializes full `knowledgeBase` (components + pages) to JSON. File includes `pages` array.
- **Import**: Parses JSON; validates `components` array; normalizes with `pages: imported.pages ?? []` so old exports without pages still work. Sends `save-knowledge` with normalized object.

## Alternative Architektur: Tool-basierter Agent

Ein Konzept für einen **Agent mit Figma-API-Tools** (Function Calling) statt einer einzigen Befehlsliste ist in **`knowledge/wireframe-tools-architecture.md`** beschrieben: Research Figma API 2026, Tool-Definitionen (createSection, createButton, addText, addPlaceholderImage, createCard), Integration mit OpenAI Tools, und „Knowledge“ als feste Recipes pro Tool.

## Relevant Files

- **Types**: `src/types/index.ts` — ScannedPage, ScannedPageSection, ComponentKnowledgeBase (components, pages, lastUpdated).
- **Page scan**: `src/agent/page-scanner.ts` — scanSelectedPage().
- **Component scan**: `src/agent/scanner.ts` — scanSelectedComponents().
- **Backend**: `src/code.ts` — normalizeKnowledge, retrieveRelevantIds, case `scan-page`, case `generate-wireframe` (retrieval + knowledgeStr + pagesStr), case `get-knowledge` / `save-knowledge` / `scan-components` (merge with pages).
- **Planner**: `src/agent/planner-agent.ts` — buildPlannerPrompt(..., pagesStr); adds "PAGE TEMPLATES (Reference)" when pagesStr present.
- **UI**: `src/components/AgentPanel.tsx` — Knowledge base title with counts, list components and pages (with remove), "Add components to knowledge", "Add page to knowledge", "Insert wireframe" button; `src/ui.tsx` — onScanPage, isScanningComponents, isScanningPage, knowledge-loaded normalizes and clears scanning flags, import normalizes pages.
