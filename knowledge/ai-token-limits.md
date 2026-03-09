# AI Token Limits (Prompt Templates & Journey/Moments Generator)

## Where token limits are defined

1. **Global default (config)**  
   `apps/api/app/core/config.py`  
   - `ai_default_max_tokens: int = 4096`  
   - Used when a template does **not** set `max_tokens`.  
   - Overridable via env: `AI_DEFAULT_MAX_TOKENS`.

2. **Prompt templates (YAML)**  
   `apps/api/app/prompts/templates.yaml`  
   Each template can set its own `max_tokens`. All set to **4096**:

   | template_id              | max_tokens | Use case                          |
   |--------------------------|------------|-----------------------------------|
   | `journey.moments`        | 4096       | Moments/Actions & Touchpoints     |
   | `journey.description`   | 4096       | Phase description                 |
   | `journey.phase.create`   | 4096       | New phase with emotion            |
   | `journey.full_generation`| 4096       | Complete journey map              |
   | `journey.phase.name`     | 4096       | Phase name suggestion             |
   | `journey.phase.emotion`  | 4096       | Phase emotion suggestion          |
   | `persona.pain_points`    | 4096       | Persona pain points               |
   | `persona.goals`          | 4096       | Persona goals                     |
   | `persona.interests`      | 4096       | Persona interests                 |
   | `persona.values`         | 4096       | Persona values                    |
   | `persona.traits`         | 4096       | Persona traits (knowledge graph)  |
   | `persona.vocabulary`     | 4096       | Persona vocabulary                |

3. **How the API uses them**  
   `apps/api/app/services/ai_assist.py`  
   - For YAML templates: `max_tokens = template.max_tokens or self.settings.ai_default_max_tokens` (line ~786).  
   - For **DB-only** templates (PromptTemplate, no YAML): hardcoded `max_tokens=4096` (line ~712), with a comment that PromptTemplate does not store config yet.

## User journey / moments generator

- **Moments (single phase)**  
  Endpoint: `POST /journeys/{journey_id}/ai/generate` with `template_id: "journey.moments"`.  
  Token limit: **4096** (from `templates.yaml`).

- **Full journey generation**  
  Implemented in `apps/api/app/services/journey_generation.py`: uses template `journey.full_generation`.  
  Token limit: **4096** (from `templates.yaml`).

So: **prompt templates** and **journey/moments generator** get their token limit from the YAML template (`max_tokens`), and only fall back to the global default (4096) if the template omits it. DB-only templates use 4096 as well.

## Changing limits

- **Per template:** Edit `apps/api/app/prompts/templates.yaml` and set `max_tokens` for the relevant `template_id`.
- **Global fallback:** Change `ai_default_max_tokens` in `apps/api/app/core/config.py` or set env `AI_DEFAULT_MAX_TOKENS`.
- **DB templates:** Fixed at 4096 in `ai_assist.py` until PromptTemplate supports config (e.g. `max_tokens` in DB).
