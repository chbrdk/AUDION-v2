# Project company context and AI-suggested target groups

## Purpose

Projects can store **company / project context** (description and free-text context). This context is used to **suggest target groups** via AI; users can then create those target groups and generate personas per group using the existing persona flow.

## Data model

### Project fields (backend)

- **description** (Text, nullable): Short project or company description.
- **company_context** (Text, nullable): Free text for industry, products, target markets, tone of voice, etc.

Defined in [apps/api/app/models/__init__.py](apps/api/app/models/__init__.py) on the `Project` model. Migration: `alembic/versions/20260309_project_company_context.py`.

**If you see `column projects.description does not exist`:** run the migration in the API environment.

- **Alembic (preferred):** In the API container: `cd /app/apps/api && alembic -c alembic.ini upgrade head` (or from repo root: `cd apps/api && alembic upgrade head`).
- **Direct SQL (if Alembic fails):** In the API container run:
  `cd /app/apps/api && python -c "
  from app.db import get_session
  from sqlalchemy import text
  with get_session() as s:
      s.execute(text('ALTER TABLE audion.projects ADD COLUMN IF NOT EXISTS description TEXT NULL'))
      s.execute(text('ALTER TABLE audion.projects ADD COLUMN IF NOT EXISTS company_context TEXT NULL'))
      s.commit()
  print('Done.')
  "`

### API

- **PATCH /api/projects/{project_id}**: Update `name`, `description`, `company_context` (all optional).
- **GET /api/projects/{project_id}**: Returns project including `description` and `company_context`.
- **POST /api/projects/{project_id}/suggest-target-groups**: Request body optional `{ "max_suggestions": 5 }`. Returns `{ "suggestions": [ { "name", "segment", "description" }, ... ] }`. Requires project membership and admin/owner role. Uses project `description` + `company_context` as input; if empty, returns 400.

## AI suggest flow

1. User fills in **Company & context** in the project admin panel and saves (PATCH project).
2. User clicks **Generate suggestions** → frontend calls **POST /api/projects/{id}/suggest-target-groups**.
3. Backend builds context string from `project.description` and `project.company_context`, calls [apps/api/app/services/suggest_target_groups.py](apps/api/app/services/suggest_target_groups.py) (OpenAI or Anthropic).
4. AI returns a JSON array of `{ name, segment, description }`; backend validates and returns it.
5. Frontend shows the list; user selects items and clicks **Create selected** (or **Create** per row). Each create is **POST /api/target-groups** with `project_id`, `name`, `segment`, `description`.

## Personas after creating target groups

After target groups are created from suggestions, users can generate personas per target group as today:

- Use the existing **generate persona** flow with `project_id` and `target_group_id`.
- [Persona generation](apps/api/app/services/persona_generation.py) uses the **target group name, segment, and description** as fallback when there are no document chunks, so the AI-written descriptions from the suggest flow feed directly into persona generation.

## AI-suggested personas (two-step flow)

Personas can be suggested from **company context + target group** and then created with basics; traits (goals, pain points, interests, values) can be filled via **enrich**.

### Step 1: Suggest personas (basic fields only)

- **Endpoint:** `POST /api/target-groups/{target_group_id}/suggest-personas`
- **Body (optional):** `{ "max_suggestions": 5 }`
- **Returns:** `{ "suggestions": [ { "name", "age", "headline", "bio", "location", "gender" }, ... ] }`
- Uses project `description` + `company_context` and the target group’s name, segment, and description. Implemented in [apps/api/app/services/suggest_personas.py](apps/api/app/services/suggest_personas.py) (OpenAI only, same pattern as suggest_target_groups).
- If company context is empty, returns `suggestions: []` (200).

### Step 2: Create personas and optionally enrich

- **Create:** Use existing `POST /api/personas` with `project_id`, `target_group_id`, `name`, `segment` (from TG), `headline`, and optionally `profile` (bio, age, location, gender, etc.).
- **Enrich:** `POST /api/personas/{persona_id}/enrich` runs AI for:
  - **Pain points, goals, interests, values** (existing).
  - **Traits** (persona.traits) – merged into `profile.traits` (dict: name → description).
  - **Vocabulary** (persona.vocabulary) – merged into `profile.communication_style.vocabulary` (list of `{ word, description }`).
  - **Sentence structure** (persona.sentence_structure) – set on `profile.communication_style.sentence_structure`.
  - **Demographics** are always written from the optional body `profile_overlay: { bio, age, location, gender }` (or existing profile), so they are never dropped. Implemented in [apps/api/app/routers/personas.py](apps/api/app/routers/personas.py) (`enrich_persona`).

### Frontend

- Project admin panel section **Suggest personas for target group**: select target group, generate suggestions, then for each suggestion **Create** (basics only) or **Create & enrich** (create + call enrich). **Create selected** creates all selected with enrich.
- i18n keys under `settingsProjects.suggestPersonas` in [apps/web/locales/en.json](apps/web/locales/en.json) and [de.json](apps/web/locales/de.json).

## Generate journey from project knowledge

A full user journey (phases and elements) can be generated from **all available project knowledge**: project description + company_context, and optionally a target group (personas + TG-linked knowledge chunks via KnowledgeExplorerService).

### Endpoint

- **POST /api/projects/{project_id}/generate-journey**
- **Auth:** Project member with admin or owner role (same as other project endpoints).
- **Body:** `{ "target_group_id": null | "<uuid>", "journey_type": "customer_journey", "organization_id": null | "<uuid>", "created_by": null | "<user_id>" }`
  - `target_group_id`: optional; if omitted, only project context is used (no personas, no TG chunks).
  - `journey_type`: e.g. `customer_journey`, `onboarding`; default `customer_journey`.
  - `organization_id`: optional; defaults to `project_id` if not provided (Journey table requires non-null `organization_id`).
- **Returns:** `201` with full **JourneyResponse** (id, name, phases with elements, etc.). The journey is created and persisted in one call.

### Flow

1. Backend loads the project and builds `company_context` from `project.description` + `project.company_context`.
2. If `target_group_id` is set: load target group (must belong to project), personas of that TG, and **KnowledgeExplorerService.get_chunks_for_target_group** (limit 50); aggregate chunk content into `knowledge_context`.
3. If no target group: `target_group_name` = "General (no target group selected)", persona_summaries = "None", knowledge = company_context only.
4. Call the **journey.full_generation** template (see [apps/api/app/prompts/templates.yaml](apps/api/app/prompts/templates.yaml)) with `company_context`, `target_group_name`, `target_group_summary`, `persona_summaries`, `knowledge_context`, `journey_type`.
5. Parse AI JSON into **JourneyDraft**; **save_journey_draft** with `target_group_id` (possibly `None`), `organization_id`, `project_id`. Element types from the AI are mapped to **JourneyElementType** (fallback `action` for unknown values).
6. Re-fetch the created journey with phases/elements/expectations loaded and return it via shared **to_journey_response** ([apps/api/app/services/journey_serializer.py](apps/api/app/services/journey_serializer.py)).

### Frontend

- Project admin panel section **Generate journey from project knowledge**: optional target group dropdown (same list as suggest personas), journey type field (default `customer_journey`), **Generate journey** button. On success, shows a message and optional link to the new journey. i18n under `settingsProjects.generateJourney`.

## Frontend

- **Project admin panel** ([apps/web/components/msqdx-glass-project-admin-panel.tsx](apps/web/components/msqdx-glass-project-admin-panel.tsx)):
  - Section **Company & context**: fields for description and company_context, Save button.
  - Section **Suggest target groups from context**: Generate button, list of suggestions with checkboxes, Create / Create selected.
- i18n keys under `settingsProjects.companyContext` in [apps/web/locales/en.json](apps/web/locales/en.json) and [de.json](apps/web/locales/de.json).

## Configuration

Same AI settings as the rest of the app: `CLAUDE_API_KEY` or `OPENAI_API_KEY`, `ai_default_provider`, `ai_anthropic_model`, `ai_openai_model`, `ai_default_max_tokens`.
