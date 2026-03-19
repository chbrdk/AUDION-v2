# RAG Compose Phase 4: Vision Post-Render & Composition Rating

## Overview

Phase 4 adds optional feedback flows after composing and rendering:

1. **Composition rating** – Thumbs up/down to rate designs
2. **Vision post-render** – Optional layout check via AI vision

## Composition Rating

- **API**: `POST /api/v1/rate-composition` (CREATION)
- **Body**: `{ compositionId: string, rating: 'up' | 'down' }`
- **Flow**: Compose returns `compositionId` (UUID). After render, thumbs appear. On click, `rateComposition(ragApiUrl, compositionId, rating)` is called.
- **Storage**: CREATION table `composition_ratings` (composition_id, rating, created_at)

## Vision Post-Render

- **API**: `POST /api/v1/validate-layout` (CREATION)
- **Body**: `{ screenshot: string }` (base64 PNG)
- **Returns**: `{ feedback: string }` – AI-generated layout review
- **Flow**:
  1. After render success, user clicks "Check layout"
  2. Plugin posts `rag-export-screenshot` to code
  3. Code exports root frame via `node.exportAsync({ format: 'PNG' })`, base64-encodes, posts `rag-screenshot-exported` with base64
  4. UI receives, calls `validateLayout(ragApiUrl, base64)`
  5. CREATION uses Claude vision to review screenshot and return feedback
  6. Feedback shown in RAGDesignPanel

## Key Paths

- **CREATION**: `src/routes/rate-composition.ts`, `src/routes/validate-layout.ts`, `src/db/migrations/008_composition_ratings.sql`
- **Plugin**: `src/api/rag-compose-client.ts` (rateComposition, validateLayout), `src/components/RAGDesignPanel.tsx` (thumbs, check layout), `src/code.ts` (rag-export-screenshot), `src/ui.tsx` (handlers)

## Config

- Vision requires `ANTHROPIC_API_KEY` in CREATION. If missing, validate-layout returns 503.

## RAG Refinement (Layout-Tools)

- **Execute**: `src/agent/rag-refinement-execute.ts` – setPadding, setGap, setAlign, setMaxWidth, etc. operieren nur auf **FrameNode**.
- **Auto-Layout**: Vor Padding/Gap/Align wird `ensureAutoLayout(frame)` aufgerufen: wenn `layoutMode === 'NONE'`, wird auf `VERTICAL` + AUTO-Sizing gesetzt, damit die Eigenschaften greifen.
- **Tool-Result**: Jedes Tool gibt bei Erfolg `result: { applied: true }` zurück; Debug-Log zeigt dann `{ applied: true }` statt `undefined`.
- **Nach Refinement**: Nach erfolgreichem Lauf wird der Root-Frame ausgewählt und `figma.viewport.scrollAndZoomIntoView([root])` aufgerufen, damit die Änderungen sichtbar sind.
