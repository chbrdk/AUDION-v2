# Journey Mapper Feature - Dokumentation

## Übersicht

Das Journey Mapper Feature ermöglicht die Erstellung und Verwaltung von Customer Journey Maps mit drei Creation-Modi (Manual, AI-generiert, Hybrid), Persona Validation mit Fit Scores, Reality Tracking (Expectations vs Measurements) und automatischer Insights-Generierung.

## Architektur

### Backend

**Models:** `apps/api/app/models/journey.py`
- `Journey` - Hauptentität für Journey Maps
- `JourneyPhase` - Phasen einer Journey
- `JourneyPhaseElement` - Elemente innerhalb einer Phase (Actions, Thoughts, Feelings, etc.)
- `JourneyExpectation` - Erwartete Metriken pro Phase
- `JourneyMeasurement` - Tatsächliche Messwerte
- `JourneyInsight` - Automatisch generierte Insights
- `JourneyChange` - Tracking von Änderungen

**Services:**
- `JourneyGenerationService` - AI-basierte Journey-Generierung
- `JourneyValidationService` - Persona Validation
- `AnalyticsIntegrationService` - Integration mit GA4/Hotjar/HubSpot
- `InsightGenerationService` - Automatische Insights-Generierung

**API:** `apps/api/app/routers/journeys.py`
- CRUD Operations für Journeys
- Phase/Element/Expectation Management
- Validation Endpoints
- Tracking & Measurements
- Insights & Changes

### Frontend

**Pages:**
- `/admin/journeys` - Journey List
- `/admin/journeys/[journeyId]` - Journey Editor
- `/admin/journeys/[journeyId]/dashboard` - Dashboard mit Measurements & Insights

**Components:**
- `msqdx-glass-journey-canvas` - Canvas für Journey Visualization
- `msqdx-glass-phase-card` - Phase Card Component
- `msqdx-glass-validation-panel` - Validation UI

**API Client:** `apps/web/app/api/_lib/journeys.ts`

## Integration mit bestehenden Features

### Target Groups

Journeys gehören zu Target Groups (wie Personas):
- Foreign Key: `journeys.target_group_id` → `target_groups.id`
- Relationship: `TargetGroup.journeys` → `List[Journey]`
- Journeys nutzen Target Group Knowledge für AI-Generierung

### Personas

Journeys können gegen Personas validiert werden:
- Foreign Key: `journey_expectations.based_on_persona_id` → `personas.id`
- Validation nutzt Persona Profile (traits, goals, pain_points, behaviors)
- Fit Scores zeigen Kompatibilität zwischen Journey und Persona

### Knowledge Base

Journey Generation nutzt:
- `RetrievalAgent` für Knowledge Retrieval aus Qdrant
- `TargetGroupService` für Target Group Knowledge Entries
- `PersonaService` für Persona Profiles

## API Endpoints

### CRUD Operations

- `POST /journeys` - Create journey
- `GET /journeys/{journey_id}` - Get journey details
- `PUT /journeys/{journey_id}` - Update journey
- `DELETE /journeys/{journey_id}` - Delete journey
- `GET /journeys` - List journeys (with filters)

### Phase Operations

- `POST /journeys/{journey_id}/phases` - Create phase
- `PUT /journeys/{journey_id}/phases/{phase_id}` - Update phase
- `DELETE /journeys/{journey_id}/phases/{phase_id}` - Delete phase
- `POST /journeys/{journey_id}/phases/{phase_id}/reorder` - Reorder phases

### Element Operations

- `POST /journeys/{journey_id}/phases/{phase_id}/elements` - Create element
- `PUT /journeys/{journey_id}/phases/{phase_id}/elements/{element_id}` - Update element
- `DELETE /journeys/{journey_id}/phases/{phase_id}/elements/{element_id}` - Delete element

### Expectation Operations

- `POST /journeys/{journey_id}/phases/{phase_id}/expectations` - Create expectation
- `GET /journeys/{journey_id}/phases/{phase_id}/expectations` - List expectations

### Validation

- `POST /journeys/{journey_id}/validate` - Validate journey against personas
- `GET /journeys/{journey_id}/validation-report` - Get validation report

### Reality Tracking

- `POST /journeys/{journey_id}/tracking/configure` - Configure tracking
- `POST /journeys/{journey_id}/tracking/sync` - Sync measurements
- `GET /journeys/{journey_id}/measurements` - Get measurements

### Insights & Learning

- `GET /journeys/{journey_id}/insights` - Get insights
- `POST /journeys/{journey_id}/insights/{insight_id}/action` - Action insight

### Change Tracking

- `POST /journeys/{journey_id}/changes` - Create change
- `GET /journeys/{journey_id}/changes` - List changes

## Celery Tasks

**Queues:**
- `journeys` - Journey generation and validation
- `analytics` - Measurement syncing and insight analysis

**Tasks:**
- `journey.generate` - Generate journey from knowledge
- `journey.validate` - Validate journey against personas
- `journey.sync_measurements` - Sync measurements from analytics
- `journey.analyze_insights` - Generate insights from measurements
- `journey.sync_all_active` - Sync all active journeys (scheduled)
- `journey.analyze_all_insights` - Analyze insights for all journeys (scheduled)

**Beat Schedule:**
- Daily at 2 AM: Sync all active journeys
- Daily at 3 AM: Analyze insights for all journeys

## Datenbank Schema

Siehe Migration: `apps/api/alembic/versions/YYYYMMDD_HHMM_add_journey_mapper_tables.py`

**Tabellen:**
1. `journeys` - Haupttabelle
2. `journey_phases` - Phasen
3. `journey_phase_elements` - Elemente
4. `journey_expectations` - Erwartungen
5. `journey_measurements` - Messwerte
6. `journey_insights` - Insights
7. `journey_changes` - Änderungen

**ENUM Types:**
- `journey_creation_mode` - manual, ai_generated, hybrid
- `journey_status` - draft, active, validated, archived
- `journey_element_type` - action, thought, feeling, touchpoint, pain_point, opportunity, question, quote
- `journey_metric_type` - sessions, users, page_views, bounce_rate, etc.
- `journey_comparison_operator` - equals, greater_than, less_than, etc.
- `journey_measurement_status` - good, warning, critical, no_data
- `journey_insight_type` - confirmation, contradiction, discovery, anomaly
- `journey_insight_status` - new, acknowledged, actioned, dismissed

## Usage

### Journey erstellen

1. **Manual:** Erstelle Journey manuell über API oder UI
2. **AI-generiert:** Nutze `JourneyGenerationService.generate_journey_from_knowledge()`
3. **Hybrid:** Kombiniere manuelle und AI-generierte Phasen

### Journey validieren

1. Wähle Personas aus Target Group
2. Rufe `POST /journeys/{journey_id}/validate` auf
3. Erhalte Fit Scores und Recommendations pro Phase

### Measurements syncen

1. Konfiguriere Data Source (GA4/Hotjar/HubSpot)
2. Rufe `POST /journeys/{journey_id}/tracking/sync` auf
3. Measurements werden automatisch gespeichert

### Insights generieren

1. Nach Measurement Sync werden automatisch Insights generiert
2. Oder manuell: `POST /journeys/{journey_id}/tracking/sync` → Insights werden generiert

## Testing

Tests befinden sich in:
- `apps/api/tests/test_journey_models.py` - Model Tests
- `apps/api/tests/test_journey_api.py` - API Tests
- `apps/api/tests/test_journey_generation.py` - Generation Tests
- `apps/api/tests/test_journey_validation.py` - Validation Tests

## Deployment

1. Migration ausführen: `cd apps/api && uv run alembic upgrade head`
2. Celery Worker für neue Queues starten: `celery -A app.celery_app worker -Q journeys,analytics`
3. Celery Beat für Scheduled Tasks: `celery -A app.celery_app beat`
4. Frontend Build: `npm run build:web`
5. Services neu starten: `docker compose up -d`

