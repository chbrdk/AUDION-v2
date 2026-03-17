# Wireframe Pipeline: Director → Designer → Figma Agent

When using the **Director → Designer → Figma** mode (styled), the wireframe is built in small steps so each API call stays fast and timeouts are less likely.

## 1. Director Agent (Planner)

- **Role**: Develops the high-level concept and splits the request into **sections**.
- **Input**: User prompt, viewport, optional knowledge (components/pages from retrieval).
- **Output**: JSON `{ "sections": [ { "type": "section", "name": "...", "description": "..." }, ... ] }` — e.g. Header, Hero, Features, CTA, Footer.
- **Code**: `PLANNER_AGENT_SYSTEM_PROMPT`, `buildPlannerPrompt`, single chat/completions call with `response_format: { type: "json_object" }`.
- **Timeout**: 90s for the Director call.

## 2. Designer Agent (Design Spec)

- **Role**: For **each section**, turns the section description into a **neutral design tree** (no Figma API terms).
- **Input**: One section (name + description), viewport, optional context name.
- **Output**: JSON `{ thinking?, root }` where `root` is a tree of nodes: container, text, placeholder, button, divider, avatar with layout (direction, gap, padding, align), fill, stroke, etc.
- **Code**: `DESIGN_SPEC_AGENT_SYSTEM_PROMPT`, `buildDesignSpecPrompt`, one chat/completions call **per section**.
- **Timeout**: 45s **per section** (Design Spec call).

## 3. Figma Agent (Executor)

- **Role**: Translates the design tree (or fallback: section description) into **Figma API commands** (createFrame, createText, loadFont, appendChild, …).
- **Input**: Design spec text (or section description), optional last error and failed commands for retry.
- **Output**: JSON `{ thinking?, commands, rootId }` — whitelisted commands only.
- **Code**: `FIGMA_API_EXPERT_SYSTEM_PROMPT`, `buildApiExpertPrompt`, `callFigmaExecutor` with `FIGMA_COMMAND_JSON_SCHEMA`.
- **Timeout**: 45s **per section** (Figma Executor call).

## Flow Summary

1. **Director** runs once → list of sections (small, fast).
2. For **each section**:
   - **Designer** runs once → design tree for that section (small call).
   - **Figma agent** runs once → commands for that section (small call).
   - **Interpreter** runs `runCommands` in plugin → nodes created and appended to context.

So the work is split into many **small calls** instead of one big call; each call has a 45s (or 90s for Director) timeout. Progress messages: "Director: Konzept & Sektionen…", "Sektion N: Designer (Design Spec)…", "Sektion N: Figma-Agent (Befehle)…".

## Alternative: Schnell (1 Call)

In **Schnell** mode, a single API call (Figma Executor only) generates all commands at once. Fewer round-trips but one large response; complex prompts can hit the 90s timeout.
