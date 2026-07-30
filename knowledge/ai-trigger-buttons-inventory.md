# AI-trigger UI inventory (AUDION-v2 web)

Last inventoried: **2026-07-30**. Scope: `apps/web` admin/chat surfaces that start an LLM or AI agent workflow. Excludes pure CRUD, document upload (unless LLM-bound), and plugin-local OpenAI keys outside persona-api.

Canonical locale notes: `knowledge/llm-output-locale-inventory.md`.

## Quick map (product area → triggers)

| Area | Route(s) | Triggers |
|------|----------|----------|
| Easy setup | `/admin/setup` | Bootstrap project+TG+persona |
| Project detail | `/admin/projects/[id]` | Research, suggest TGs, suggest personas (+enrich), generate journey |
| Target groups overview | `/admin/target-groups`, `/admin/target-groups-v2` | Suggest TGs (bilingual) |
| TG detail / personas panel | `/admin/target-groups/[id]`, `/admin/target-groups-v2/.../personas` | Generate persona |
| Personas overview | `/admin/personas`, `/admin/personas-v2` | Generate persona |
| Persona detail | `/admin/personas/[id]`, `/admin/personas-v2/...` | Enrich, avatar, chat prompt, chip AI-assist, moodboard, translate-fields |
| Journeys | `/admin/journeys/new`, `/admin/journeys/[id]`, overview convert tab | Full journey generate, phase/moments AI, UX-run→journey (AI mode) |
| UX Journey Agent | `/admin/ux-journey-agent` | Browser agent run |
| Chat | `/admin/chat`, `/chat` | Message stream + inspect_website approve + video finalize + convert |
| Prompts | `/admin/settings/prompts` | Test prompt |

See full detail in chat / parent agent report.
