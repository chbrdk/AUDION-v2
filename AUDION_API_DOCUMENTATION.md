# AUDION API Dokumentation

Vollständige Übersicht aller verfügbaren API-Endpunkte der AUDION Dynamic Persona Chat API.

## Base URL

- **Development**: `http://localhost:8000` (oder konfigurierter Port)
- **Production**: `/audion` (via Nginx)
- **API Version**: `v1` (wird nicht explizit in der URL verwendet)

## Health Checks

### GET /health
Health Check Endpoint

**Response:**
```json
{
  "status": "ok"
}
```

---

## Personas API

**Base Path:** `/personas`

Endpunkte für die Verwaltung von Personas (Kundenprofile mit AI-generierten Eigenschaften).

### GET /personas
Listet alle Personas auf mit Filterung und Pagination.

**Query Parameters:**
- `project_id` (string, optional): Filter nach Project ID
- `target_group_id` (string, optional): Filter nach Target Group ID
- `status` (string, optional): Filter nach Status
- `q` / `search` (string, optional): Suchbegriff für Name oder Attribute
- `page` (int, default: 1): Seitennummer (min: 1)
- `page_size` (int, default: 20): Anzahl Ergebnisse pro Seite (1-100)

**Response:** `PersonaListResponse`

### POST /personas
Erstellt eine neue Persona manuell.

**Request Body:** `PersonaCreateRequest`
```json
{
  "project_id": "uuid",
  "name": "Persona Name",
  "segment": "Segment Description",
  "headline": "Headline",
  "bio": "Biography",
  "profile": {
    "demographics": {},
    "goals": [],
    "pain_points": [],
    "traits": [],
    "communication_style": {}
  },
  "confidence": 0.8,
  "version": "1.0.0"
}
```

**Response:** `PersonaResponse` (201 Created)

### POST /personas/generate
Generiert automatisch eine Persona mit AI basierend auf Research-Daten.

**Request Body:** `PersonaGenerateRequest`
```json
{
  "project_id": "uuid",
  "segment": "Segment Description",
  "description": "Optional description",
  "filter_mode": "auto",
  "chunk_ids": [],
  "target_group_id": "uuid",
  "variation_params": {
    "randomize_chunks": false,
    "temperature": 0.7,
    "prompt_style": "vivid",
    "chunk_sample_size": 10
  }
}
```

**Response:** `PersonaResponse`

**Hinweis:** Generation ist asynchron. Die Persona wird zunächst mit "Pending Persona" erstellt und dann aktualisiert.

### GET /personas/{persona_id}
Holt Details einer Persona.

**Path Parameters:**
- `persona_id` (UUID): ID der Persona

**Response:** `PersonaResponse`

### PATCH /personas/{persona_id}
Aktualisiert eine Persona (partiell).

**Path Parameters:**
- `persona_id` (UUID): ID der Persona

**Request Body:**
```json
{
  "name": "New Name",
  "segment": "New Segment",
  "headline": "New Headline",
  "bio": "New Bio",
  "profile": {},
  "confidence": 0.9,
  "version": "1.1.0",
  "status": "active",
  "image_url": "url",
  "prompt": {}
}
```

**Response:** `PersonaResponse`

### DELETE /personas/{persona_id}
Löscht eine Persona permanent.

**Path Parameters:**
- `persona_id` (UUID): ID der Persona

**Query Parameters:**
- `actor` (string, optional): Wer führt die Löschung durch (für Audit-Log)

**Response:** 204 No Content

### POST /personas/{persona_id}/ai/pain-points
Generiert AI-Vorschläge für Persona Pain Points.

**Path Parameters:**
- `persona_id` (UUID): ID der Persona

**Request Body:**
```json
{
  "max_items": 3
}
```

**Response:** `AiAssistResponse`

### POST /personas/{persona_id}/ai/interests
Generiert AI-Vorschläge für Persona Interests.

**Path Parameters:**
- `persona_id` (UUID): ID der Persona

**Request Body:**
```json
{
  "max_items": 3
}
```

**Response:** `AiAssistResponse`

### POST /personas/{persona_id}/ai/values
Generiert AI-Vorschläge für Persona Values.

**Path Parameters:**
- `persona_id` (UUID): ID der Persona

**Request Body:**
```json
{
  "max_items": 3
}
```

**Response:** `AiAssistResponse`

### POST /personas/{persona_id}/ai/goals
Generiert AI-Vorschläge für Persona Goals.

**Path Parameters:**
- `persona_id` (UUID): ID der Persona

**Request Body:**
```json
{
  "max_items": 3
}
```

**Response:** `AiAssistResponse`

### GET /personas/{persona_id}/documents
Listet alle Dokumente einer Persona auf.

**Path Parameters:**
- `persona_id` (UUID): ID der Persona

**Response:** `List[PersonaDocument]`

### POST /personas/{persona_id}/documents
Lädt ein Dokument für eine Persona hoch.

**Path Parameters:**
- `persona_id` (UUID): ID der Persona

**Form Data:**
- `file` (file, required): Datei zum Hochladen
- `uploaded_by` (string, default: "persona-admin-ui"): Wer hat hochgeladen

**Response:** `PersonaDocument` (201 Created)

**Hinweis:** Verarbeitung erfolgt asynchron. Dokument wird gechunkt, embedded und in Qdrant gespeichert.

### GET /personas/{persona_id}/documents/{document_id}/download
Lädt ein Dokument herunter.

**Path Parameters:**
- `persona_id` (UUID): ID der Persona
- `document_id` (UUID): ID des Dokuments

**Response:** Streaming Response (Datei)

### POST /personas/{persona_id}/documents/{document_id}/retry
Wiederholt die Ingestion eines fehlgeschlagenen Dokuments.

**Path Parameters:**
- `persona_id` (UUID): ID der Persona
- `document_id` (UUID): ID des Dokuments

**Response:** `PersonaDocument`

### DELETE /personas/{persona_id}/documents/{document_id}
Löscht ein Dokument permanent.

**Path Parameters:**
- `persona_id` (UUID): ID der Persona
- `document_id` (UUID): ID des Dokuments

**Response:** 204 No Content

### GET /personas/{persona_id}/knowledge
Listet alle Knowledge Entries einer Persona auf.

**Path Parameters:**
- `persona_id` (UUID): ID der Persona

**Response:** `List[PersonaKnowledgeEntry]`

### POST /personas/{persona_id}/knowledge
Fügt einen Knowledge Entry zu einer Persona hinzu.

**Path Parameters:**
- `persona_id` (UUID): ID der Persona

**Request Body:**
```json
{
  "title": "Knowledge Title",
  "content": "Knowledge Content",
  "metadata": {},
  "created_by": "user-id"
}
```

**Response:** `PersonaKnowledgeEntry` (201 Created)

### POST /personas/{persona_id}/avatar
Lädt ein Avatar-Bild für eine Persona hoch.

**Path Parameters:**
- `persona_id` (UUID): ID der Persona

**Form Data:**
- `file` (file, required): Bilddatei (PNG, JPEG, etc.)
- `updated_by` (string, default: "persona-admin-ui"): Wer hat hochgeladen

**Response:** `PersonaResponse`

### GET /personas/{persona_id}/avatar
Holt das Avatar-Bild einer Persona.

**Path Parameters:**
- `persona_id` (UUID): ID der Persona

**Response:** Streaming Response (Bild) oder Redirect

---

## Journeys API

**Base Path:** `/journeys`

Endpunkte für die Verwaltung von Customer Journeys (Kundenreisen).

### GET /journeys
Listet alle Journeys auf.

**Query Parameters:**
- `target_group_id` (string, optional): Filter nach Target Group ID
- `project_id` (string, optional): Filter nach Project ID
- `page` (int, default: 1): Seitennummer (min: 1)
- `page_size` (int, default: 20): Anzahl Ergebnisse pro Seite (1-100)

**Response:** `List[JourneyResponse]`

### POST /journeys
Erstellt eine neue Journey.

**Request Body:** `JourneyCreate`
```json
{
  "organization_id": "uuid",
  "project_id": "uuid",
  "target_group_id": "uuid",
  "name": "Journey Name",
  "description": "Journey Description",
  "journey_type": "purchase",
  "creation_mode": "manual"
}
```

**Response:** `JourneyResponse` (201 Created)

### POST /journeys/generate
Generiert automatisch eine Journey mit AI.

**Request Body:** `JourneyGenerateRequest`
```json
{
  "target_group_id": "uuid",
  "journey_type": "purchase",
  "organization_id": "uuid",
  "created_by": "user-id",
  "project_id": "uuid",
  "use_async": false
}
```

**Response:** `JourneyResponse` (201 Created) oder 202 Accepted (wenn async)

**Hinweis:** Kann synchron oder asynchron (via Celery) laufen.

### GET /journeys/{journey_id}
Holt Details einer Journey.

**Path Parameters:**
- `journey_id` (UUID): ID der Journey

**Response:** `JourneyResponse`

### PUT /journeys/{journey_id}
Aktualisiert eine Journey.

**Path Parameters:**
- `journey_id` (UUID): ID der Journey

**Request Body:** `JourneyCreate`

**Response:** `JourneyResponse`

### DELETE /journeys/{journey_id}
Löscht eine Journey.

**Path Parameters:**
- `journey_id` (UUID): ID der Journey

**Response:** 204 No Content

### POST /journeys/{journey_id}/ai/generate
Generiert AI-Vorschläge für Journey-Inhalt.

**Path Parameters:**
- `journey_id` (UUID): ID der Journey

**Request Body:** `JourneyAiGenerateRequest`
```json
{
  "template_id": "journey.phase.elements",
  "phase_id": "uuid",
  "phase_context": {},
  "prompt_variables": {},
  "max_suggestions": 5
}
```

**Response:** `JourneyAiGenerationResponse`

### POST /journeys/{journey_id}/validate
Validiert eine Journey gegen Personas.

**Path Parameters:**
- `journey_id` (UUID): ID der Journey

**Request Body:** `ValidationRequest`
```json
{
  "persona_ids": ["uuid"],
  "mode": "strict"
}
```

**Response:** `JourneyValidationReport`

### GET /journeys/{journey_id}/validation-report
Holt den Validierungsreport einer Journey.

**Path Parameters:**
- `journey_id` (UUID): ID der Journey

**Query Parameters:**
- `persona_id` (string, required): Persona ID für Validierung

**Response:** `JourneyValidationReport`

### POST /journeys/{journey_id}/phases
Erstellt eine Phase in einer Journey.

**Path Parameters:**
- `journey_id` (UUID): ID der Journey

**Request Body:** `PhaseCreate`
```json
{
  "name": "Phase Name",
  "description": "Phase Description",
  "phase_order": 1,
  "expected_duration_min": 5,
  "expected_duration_max": 10,
  "duration_unit": "minutes",
  "expected_emotion": "curious",
  "emotion_intensity": 0.7,
  "url_pattern": "/checkout",
  "form_id": "checkout-form",
  "event_names": ["checkout_started"]
}
```

**Response:** `PhaseResponse` (201 Created)

### PUT /journeys/{journey_id}/phases/{phase_id}
Aktualisiert eine Phase.

**Path Parameters:**
- `journey_id` (UUID): ID der Journey
- `phase_id` (UUID): ID der Phase

**Request Body:** `PhaseCreate`

**Response:** `PhaseResponse`

### DELETE /journeys/{journey_id}/phases/{phase_id}
Löscht eine Phase.

**Path Parameters:**
- `journey_id` (UUID): ID der Journey
- `phase_id` (UUID): ID der Phase

**Response:** 204 No Content

### POST /journeys/{journey_id}/phases/{phase_id}/reorder
Ordnet Phasen neu an.

**Path Parameters:**
- `journey_id` (UUID): ID der Journey
- `phase_id` (UUID): ID der Phase

**Query Parameters:**
- `new_order` (int, required): Neue Reihenfolge (min: 0)

**Response:**
```json
{
  "status": "ok"
}
```

### POST /journeys/{journey_id}/phases/{phase_id}/elements
Erstellt ein Element in einer Phase.

**Path Parameters:**
- `journey_id` (UUID): ID der Journey
- `phase_id` (UUID): ID der Phase

**Request Body:** `ElementCreate`
```json
{
  "element_type": "touchpoint",
  "content": "Element Content",
  "element_order": 1,
  "metadata": {},
  "source_type": "knowledge",
  "source_chunk_ids": ["uuid"],
  "confidence": 0.9
}
```

**Response:** `ElementResponse` (201 Created)

### PUT /journeys/{journey_id}/phases/{phase_id}/elements/{element_id}
Aktualisiert ein Element.

**Path Parameters:**
- `journey_id` (UUID): ID der Journey
- `phase_id` (UUID): ID der Phase
- `element_id` (UUID): ID des Elements

**Request Body:** `ElementCreate`

**Response:** `ElementResponse`

### DELETE /journeys/{journey_id}/phases/{phase_id}/elements/{element_id}
Löscht ein Element.

**Path Parameters:**
- `journey_id` (UUID): ID der Journey
- `phase_id` (UUID): ID der Phase
- `element_id` (UUID): ID des Elements

**Response:** 204 No Content

### POST /journeys/{journey_id}/phases/{phase_id}/expectations
Erstellt eine Erwartung (Metric) für eine Phase.

**Path Parameters:**
- `journey_id` (UUID): ID der Journey
- `phase_id` (UUID): ID der Phase

**Request Body:** `ExpectationCreate`
```json
{
  "metric_type": "conversion_rate",
  "metric_name": "Checkout Completion",
  "expected_value": 0.25,
  "expected_value_max": 0.30,
  "unit": "percent",
  "comparison": "greater_than",
  "warning_threshold_percent": 10,
  "critical_threshold_percent": 20,
  "hypothesis": "Users should complete checkout",
  "based_on_persona_id": "uuid",
  "data_source": "analytics",
  "data_source_config": {}
}
```

**Response:** `ExpectationResponse` (201 Created)

### GET /journeys/{journey_id}/phases/{phase_id}/expectations
Listet alle Erwartungen einer Phase auf.

**Path Parameters:**
- `journey_id` (UUID): ID der Journey
- `phase_id` (UUID): ID der Phase

**Response:** `List[ExpectationResponse]`

### POST /journeys/{journey_id}/tracking/configure
Konfiguriert Tracking für eine Journey.

**Path Parameters:**
- `journey_id` (UUID): ID der Journey

**Response:**
```json
{
  "status": "ok",
  "tracking_enabled": true
}
```

### POST /journeys/{journey_id}/tracking/sync
Synchronisiert Measurements von Analytics-Systemen.

**Path Parameters:**
- `journey_id` (UUID): ID der Journey

**Query Parameters:**
- `period_start` (string, optional): Start-Datum (ISO 8601)
- `period_end` (string, optional): End-Datum (ISO 8601)

**Response:**
```json
{
  "status": "ok",
  "measurements_count": 10
}
```

### GET /journeys/{journey_id}/measurements
Holt alle Measurements einer Journey.

**Path Parameters:**
- `journey_id` (UUID): ID der Journey

**Response:** `List[MeasurementResponse]`

### GET /journeys/{journey_id}/insights
Holt alle Insights einer Journey.

**Path Parameters:**
- `journey_id` (UUID): ID der Journey

**Response:** `List[InsightResponse]`

### POST /journeys/{journey_id}/insights/{insight_id}/action
Setzt Status eines Insights.

**Path Parameters:**
- `journey_id` (UUID): ID der Journey
- `insight_id` (UUID): ID des Insights

**Query Parameters:**
- `status` (string, default: "actioned"): Neuer Status (`acknowledged`, `actioned`, `dismissed`)

**Response:**
```json
{
  "status": "ok",
  "insight_id": "uuid",
  "new_status": "actioned"
}
```

### POST /journeys/{journey_id}/changes
Erstellt einen Change-Eintrag.

**Path Parameters:**
- `journey_id` (UUID): ID der Journey

**Query Parameters:**
- `title` (string, required): Change-Titel
- `description` (string, optional): Change-Beschreibung
- `change_type` (string, required): Change-Typ
- `phase_id` (string, optional): Phase ID
- `triggered_by_insight_id` (string, optional): Insight ID

**Response:** `ChangeResponse`

### GET /journeys/{journey_id}/changes
Listet alle Changes einer Journey auf.

**Path Parameters:**
- `journey_id` (UUID): ID der Journey

**Response:** `List[ChangeResponse]`

---

## Target Groups API

**Base Path:** `/target-groups`

Endpunkte für die Verwaltung von Target Groups (Organisationseinheiten für Knowledge und Personas).

### GET /target-groups
Listet alle Target Groups auf.

**Query Parameters:**
- `project_id` (string, optional): Filter nach Project ID
- `page` (int, default: 1): Seitennummer (min: 1)
- `page_size` (int, default: 20): Anzahl Ergebnisse pro Seite (1-100)

**Response:** `TargetGroupListResponse`

### POST /target-groups
Erstellt eine neue Target Group.

**Request Body:** `TargetGroupCreateRequest`
```json
{
  "project_id": "uuid",
  "name": "Target Group Name",
  "description": "Description",
  "metadata": {}
}
```

**Response:** `TargetGroupResponse` (201 Created)

### GET /target-groups/{target_group_id}
Holt Details einer Target Group.

**Path Parameters:**
- `target_group_id` (UUID): ID der Target Group

**Response:** `TargetGroupResponse`

### PATCH /target-groups/{target_group_id}
Aktualisiert eine Target Group (partiell).

**Path Parameters:**
- `target_group_id` (UUID): ID der Target Group

**Request Body:** `TargetGroupUpdateRequest`
```json
{
  "name": "New Name",
  "description": "New Description",
  "metadata": {}
}
```

**Response:** `TargetGroupResponse`

### GET /target-groups/{target_group_id}/knowledge/chunks
Listet alle Knowledge Chunks einer Target Group auf.

**Path Parameters:**
- `target_group_id` (UUID): ID der Target Group

**Query Parameters:**
- `limit` (int, default: 1000): Maximale Anzahl (1-5000)

**Response:** `List[KnowledgeChunk]`

### GET /target-groups/{target_group_id}/knowledge/clusters
Führt Clustering-Analyse auf Knowledge Chunks aus.

**Path Parameters:**
- `target_group_id` (UUID): ID der Target Group

**Query Parameters:**
- `method` (string, default: "kmeans"): Clustering-Methode (`kmeans` oder `dbscan`)
- `n_clusters` (int, default: 10): Anzahl Cluster für K-Means (2-50)
- `min_samples` (int, default: 3): Min Samples für DBSCAN (2-20)
- `limit` (int, default: 1000): Maximale Anzahl Chunks (1-5000)

**Response:** `ClusterResult`

### GET /target-groups/{target_group_id}/knowledge/chunks/{chunk_id}/similar
Findet ähnliche Chunks zu einem gegebenen Chunk.

**Path Parameters:**
- `target_group_id` (UUID): ID der Target Group
- `chunk_id` (UUID): ID des Chunks

**Query Parameters:**
- `limit` (int, default: 10): Maximale Anzahl ähnlicher Chunks (1-50)

**Response:** `List[SimilarChunk]`

### GET /target-groups/{target_group_id}/knowledge
Listet alle manuellen Knowledge Entries einer Target Group auf.

**Path Parameters:**
- `target_group_id` (UUID): ID der Target Group

**Response:** `List[PersonaKnowledgeEntry]`

### POST /target-groups/{target_group_id}/knowledge
Fügt einen manuellen Knowledge Entry hinzu.

**Path Parameters:**
- `target_group_id` (UUID): ID der Target Group

**Request Body:**
```json
{
  "title": "Knowledge Title",
  "content": "Knowledge Content",
  "metadata": {},
  "created_by": "user-id"
}
```

**Response:** `PersonaKnowledgeEntry` (201 Created)

**Hinweis:** Wird automatisch embedded und in Qdrant gespeichert.

### PUT /target-groups/{target_group_id}/knowledge/{knowledge_id}
Aktualisiert einen Knowledge Entry.

**Path Parameters:**
- `target_group_id` (UUID): ID der Target Group
- `knowledge_id` (UUID): ID des Knowledge Entries

**Request Body:**
```json
{
  "title": "Updated Title",
  "content": "Updated Content",
  "metadata": {}
}
```

**Response:** `PersonaKnowledgeEntry`

### DELETE /target-groups/{target_group_id}/knowledge/{knowledge_id}
Löscht einen Knowledge Entry.

**Path Parameters:**
- `target_group_id` (UUID): ID der Target Group
- `knowledge_id` (UUID): ID des Knowledge Entries

**Response:** 204 No Content

### GET /target-groups/{target_group_id}/documents
Listet alle Dokumente einer Target Group auf.

**Path Parameters:**
- `target_group_id` (UUID): ID der Target Group

**Response:** `List[PersonaDocument]`

### POST /target-groups/{target_group_id}/documents
Lädt ein Dokument für eine Target Group hoch.

**Path Parameters:**
- `target_group_id` (UUID): ID der Target Group

**Form Data:**
- `file` (file, required): Datei zum Hochladen
- `uploaded_by` (string, default: "target-group-admin-ui"): Wer hat hochgeladen

**Response:** `PersonaDocument` (201 Created)

### GET /target-groups/{target_group_id}/personas
Listet alle Personas einer Target Group auf.

**Path Parameters:**
- `target_group_id` (UUID): ID der Target Group

**Query Parameters:**
- `status` (string, optional): Filter nach Status
- `q` / `search` (string, optional): Suchbegriff
- `page` (int, default: 1): Seitennummer (min: 1)
- `page_size` (int, default: 20): Anzahl Ergebnisse pro Seite (1-100)

**Response:** `PersonaListResponse`

### POST /target-groups/{target_group_id}/personas/generate
Generiert automatisch eine Persona für eine Target Group.

**Path Parameters:**
- `target_group_id` (UUID): ID der Target Group

**Request Body:** `TargetGroupPersonaGenerateRequest`
```json
{
  "segment": "Segment Description",
  "description": "Optional description",
  "filter_mode": "auto",
  "document_ids": [],
  "chunk_ids": [],
  "chunk_weights": {},
  "limit_chunks": 50,
  "variation_params": {
    "randomize_chunks": false,
    "temperature": 0.7,
    "prompt_style": "vivid",
    "chunk_sample_size": 10,
    "seed": null
  }
}
```

**Response:** `PersonaResponse` (201 Created)

**Filter Modes:**
- `"auto"`: Automatisch relevante Chunks auswählen
- `"documents"`: Nur Chunks aus spezifischen Dokumenten verwenden
- `"chunks_manual"`: Nur spezifische Chunks verwenden

---

## Documents API

**Base Path:** `/documents`

Endpunkte für das Upload und Verwalten von Dokumenten.

### POST /documents/upload
Lädt ein Dokument für Verarbeitung hoch.

**Form Data:**
- `file` (file, required): Dokumentdatei (PDF, DOCX, TXT, etc.)

**Response:** `DocumentUploadResponse`
```json
{
  "job_id": "uuid"
}
```

**Hinweis:** Verarbeitung erfolgt asynchron. Verwende `job_id` zum Status-Check.

### GET /documents/{job_id}/status
Holt den Status eines Document Processing Jobs.

**Path Parameters:**
- `job_id` (UUID): ID des Processing Jobs

**Response:** `UploadJobStatus`
```json
{
  "status": "processing",
  "progress": 50,
  "document_id": "uuid",
  "reason": null
}
```

**Status Werte:** `pending`, `processing`, `completed`, `failed`

---

## AI Assist API

**Base Path:** `/ai-assist`

Endpunkte für AI-gestützte Vorschläge und Prompt-Templates.

### GET /ai-assist/templates
Listet alle verfügbaren AI Prompt Templates auf.

**Response:** `List[AiTemplateSummary]`

### POST /ai-assist
Führt ein AI Assist Template aus.

**Request Body:** `AiAssistRequest`
```json
{
  "template_id": "persona.pain_points",
  "provider": "anthropic",
  "model": "claude-3-5-haiku-20241022",
  "context": {
    "persona_id": "uuid",
    "max_items": 3
  },
  "prompt_variables": {},
  "max_suggestions": 3,
  "metadata": {}
}
```

**Response:** `AiAssistResponse`

### POST /ai-assist/test
Testet einen Custom Prompt direkt ohne Template.

**Request Body:** `AiPromptTestRequest`
```json
{
  "prompt": "Custom prompt text",
  "context": {},
  "provider": "anthropic",
  "model": "claude-3-5-haiku-20241022",
  "temperature": 0.7,
  "max_tokens": 2000
}
```

**Response:** `AiAssistResponse`

---

## Settings API

**Base Path:** `/settings`

Endpunkte für System-Einstellungen und Template-Verwaltung.

### GET /settings/ai/providers
Listet verfügbare AI Provider auf.

**Response:**
```json
{
  "default_provider": "anthropic",
  "providers": [
    {
      "id": "anthropic",
      "label": "Anthropic Claude",
      "model": "claude-3-5-haiku-20241022",
      "api_key_configured": true
    },
    {
      "id": "openai",
      "label": "OpenAI GPT",
      "model": "gpt-4",
      "api_key_configured": false
    }
  ]
}
```

### GET /settings/ai/templates
Listet alle AI Templates auf.

**Response:** `List[AiTemplateSummary]`

### GET /settings/ai/templates/{template_id}
Holt Details eines AI Templates.

**Path Parameters:**
- `template_id` (string): ID des Templates

**Response:** `AiTemplateDefinition`

### PUT /settings/ai/templates/{template_id}
Aktualisiert ein AI Template.

**Path Parameters:**
- `template_id` (string): ID des Templates

**Request Body:** `AiTemplateUpdateRequest`
```json
{
  "label": "New Label",
  "description": "New Description",
  "category": "Category",
  "tags": ["tag1", "tag2"],
  "prompt": "New prompt text",
  "default_provider": "anthropic",
  "default_model": "claude-3-5-haiku-20241022",
  "temperature": 0.7,
  "max_tokens": 2000,
  "output": {}
}
```

**Response:** `AiTemplateDefinition`

### GET /settings/ai/persona-prompts
Listet alle Persona Prompts auf.

**Response:** `List[dict]`

### GET /settings/ai/persona-prompts/{persona_id}
Holt einen Persona Prompt als Template-Definition.

**Path Parameters:**
- `persona_id` (UUID): ID der Persona

**Response:** `AiTemplateDefinition`

### PUT /settings/ai/persona-prompts/{persona_id}
Aktualisiert einen Persona Prompt.

**Path Parameters:**
- `persona_id` (UUID): ID der Persona

**Request Body:** `AiTemplateUpdateRequest`

**Response:** `AiTemplateDefinition`

---

## Queue API

**Base Path:** `/queue`

Endpunkte für die Verwaltung von Processing Jobs und Queue-Monitoring.

### GET /queue/jobs
Listet Processing Jobs auf mit Filterung und Pagination.

**Query Parameters:**
- `status` (string, optional): Filter nach Status (`pending`, `processing`, `completed`, `failed`)
- `document_id` (string, optional): Filter nach Document ID
- `page` (int, default: 1): Seitennummer (min: 1)
- `page_size` (int, default: 20): Anzahl Ergebnisse pro Seite (1-100)
- `date_from` (datetime, optional): Filter Jobs nach diesem Datum (ISO 8601)
- `date_to` (datetime, optional): Filter Jobs vor diesem Datum (ISO 8601)

**Response:** `ProcessingJobListResponse`

### GET /queue/jobs/{job_id}
Holt Details eines Processing Jobs.

**Path Parameters:**
- `job_id` (UUID): ID des Jobs

**Response:** `ProcessingJobDetailResponse`

### GET /queue/jobs/{job_id}/task
Holt den Celery Task Status eines Jobs.

**Path Parameters:**
- `job_id` (UUID): ID des Jobs

**Response:** `CeleryTaskStatus`

### GET /queue/stats
Holt Queue-Statistiken.

**Response:** `QueueStatsResponse`
```json
{
  "total": 1000,
  "pending": 10,
  "processing": 5,
  "completed": 950,
  "failed": 35
}
```

### POST /queue/jobs/{job_id}/retry
Wiederholt einen fehlgeschlagenen Job.

**Path Parameters:**
- `job_id` (UUID): ID des Jobs

**Response:** `ProcessingJobDetailResponse`

### GET /queue/logs
Holt Processing Logs mit Filterung.

**Query Parameters:**
- `level` (string, optional): Filter nach Level (`DEBUG`, `INFO`, `WARNING`, `ERROR`)
- `job_id` (string, optional): Filter nach Job ID
- `document_id` (string, optional): Filter nach Document ID
- `page` (int, default: 1): Seitennummer (min: 1)
- `page_size` (int, default: 50): Anzahl Ergebnisse pro Seite (1-200)
- `date_from` (datetime, optional): Filter Logs nach diesem Datum (ISO 8601)
- `date_to` (datetime, optional): Filter Logs vor diesem Datum (ISO 8601)

**Response:** `LogListResponse`

### GET /queue/service-status
Holt Status aller System-Services.

**Response:** `ServiceStatusResponse`
```json
{
  "services": [
    {
      "name": "PostgreSQL",
      "status": "up",
      "message": "connected"
    },
    {
      "name": "Redis",
      "status": "up",
      "message": "connected"
    },
    {
      "name": "Qdrant",
      "status": "up",
      "message": "connected"
    }
  ],
  "all_services_up": true
}
```

---

## WebSocket Chat API

**Base Path:** `/ws/chat/{conversation_id}`

WebSocket-Endpoint für Echtzeit-Chat und Persona Discovery.

### WebSocket Connection

**URL:** `ws://localhost:8000/ws/chat/{conversation_id}`

**Path Parameters:**
- `conversation_id` (string): ID der Konversation

**Protokoll:**

**Client → Server:**
```json
{
  "type": "message",
  "content": "User query text"
}
```

**Server → Client:**

**Thinking Event:**
```json
{
  "type": "thinking",
  "status": "Analyzing research…"
}
```

**Personas Discovered Event:**
```json
{
  "type": "personas_discovered",
  "personas": [
    {
      "persona_id": "uuid",
      "name": "Persona Name",
      "segment": "Segment",
      "confidence": 0.85
    }
  ]
}
```

**Hinweis:** Der Server verwendet Retrieval Agent und Persona Discovery Service, um relevante Personas basierend auf der User Query zu finden.

---

## Fehlerbehandlung

Alle Endpunkte können folgende HTTP-Status-Codes zurückgeben:

- **200 OK**: Erfolgreiche Anfrage
- **201 Created**: Ressource erfolgreich erstellt
- **202 Accepted**: Anfrage akzeptiert (async processing)
- **204 No Content**: Erfolgreiche Löschung
- **400 Bad Request**: Ungültige Anfrage-Parameter
- **404 Not Found**: Ressource nicht gefunden
- **500 Internal Server Error**: Server-Fehler

Fehler-Responses haben folgendes Format:
```json
{
  "detail": "Error message"
}
```

---

## Authentifizierung

Die API verwendet derzeit keine Authentifizierung (CORS ist auf `allow_origins=["*"]` gesetzt). Für Production sollte Authentifizierung implementiert werden.

---

## Rate Limiting

Derzeit ist kein Rate Limiting implementiert. Für Production sollte Rate Limiting implementiert werden.

---

## Pagination

Viele Endpunkte unterstützen Pagination via `page` und `page_size` Query-Parametern:

- `page`: Seitennummer (typischerweise >= 1)
- `page_size`: Anzahl Ergebnisse pro Seite (typischerweise 1-100)

**Response Format:**
```json
{
  "items": [...],
  "total": 100,
  "page": 1,
  "page_size": 20
}
```

---

## Datentypen

- **UUID**: Universally Unique Identifier (Format: `"550e8400-e29b-41d4-a716-446655440000"`)
- **DateTime**: ISO 8601 Format (z.B. `"2024-01-01T00:00:00Z"`)
- **JSONB**: JSON-Objekt oder Array (PostgreSQL JSONB)
- **Numeric**: Dezimalzahl (typischerweise für Scores, 0.0-1.0)

---

## Weitere Informationen

- API-Titel: "Dynamic Persona Chat API"
- API-Version: "0.1.0"
- Framework: FastAPI
- Datenbank: PostgreSQL
- Background Jobs: Celery
- Vector Store: Qdrant
- Graph Database: Neo4j

---

## Integration mit anderen Services

- **STORION**: Optional für zentrale Dateispeicherung (wenn `use_storion_proxy` aktiviert)
- **Indexing API**: Für Dokument-Processing
- **Chat API**: Für Echtzeit-Chat-Funktionalität
- **UNION**: Für Request-Logging und Metriken
