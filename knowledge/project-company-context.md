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

- **Create:** Use existing `POST /api/personas` with `project_id`, `target_group_id`, `name`, `segment` (from TG), `headline`, and `profile: { bio, age, location, gender, pain_points: [], goals: [], ... }`.
- **Enrich:** `POST /api/personas/{persona_id}/enrich` runs the four AI-assist templates (pain points, goals, interests, values) and merges the results into the persona profile. Implemented in [apps/api/app/routers/personas.py](apps/api/app/routers/personas.py) (`enrich_persona`).

### Frontend

- Project admin panel section **Suggest personas for target group**: select target group, generate suggestions, then for each suggestion **Create** (basics only) or **Create & enrich** (create + call enrich). **Create selected** creates all selected with enrich.
- i18n keys under `settingsProjects.suggestPersonas` in [apps/web/locales/en.json](apps/web/locales/en.json) and [de.json](apps/web/locales/de.json).

## Frontend

- **Project admin panel** ([apps/web/components/msqdx-glass-project-admin-panel.tsx](apps/web/components/msqdx-glass-project-admin-panel.tsx)):
  - Section **Company & context**: fields for description and company_context, Save button.
  - Section **Suggest target groups from context**: Generate button, list of suggestions with checkboxes, Create / Create selected.
- i18n keys under `settingsProjects.companyContext` in [apps/web/locales/en.json](apps/web/locales/en.json) and [de.json](apps/web/locales/de.json).

## Configuration

Same AI settings as the rest of the app: `CLAUDE_API_KEY` or `OPENAI_API_KEY`, `ai_default_provider`, `ai_anthropic_model`, `ai_openai_model`, `ai_default_max_tokens`.
