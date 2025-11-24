# Target Group Migration Guide

## Überblick

Die Target Group Architektur wurde eingeführt, um Personas in verwandten Gruppen zu organisieren und Knowledge auf Target Group Ebene zu verorten. Dies ermöglicht:

- Mehrere Persona-Varianten pro Target Group
- Gemeinsames Knowledge für alle Personas einer Target Group
- Zufällige Persona-Generierung basierend auf Target Group Knowledge
- Effizientere Knowledge-Wartung

## Migration Schritte

### 1. Datenbank-Migration

Die Alembic Migration `20251121_2138_add_target_groups` führt automatisch folgende Schritte aus:

1. **Erstellt neue Tabellen:**
   - `target_groups`: Container für verwandte Personas
   - `target_group_sources`: Knowledge chunks für Target Groups
   - `target_group_knowledge_entries`: Manual knowledge entries für Target Groups

2. **Erweitert Persona Tabelle:**
   - Fügt `target_group_id` Spalte hinzu (nullable)

3. **Migriert existierende Daten:**
   - Erstellt Target Groups aus unique Persona Segments
   - Setzt `target_group_id` in Personas basierend auf Segment
   - Migriert `PersonaSource` → `TargetGroupSource`
   - Migriert `PersonaKnowledgeEntry` → `TargetGroupKnowledgeEntry`

### 2. Qdrant Migration

Nach der Datenbank-Migration müssen existierende Qdrant Points aktualisiert werden:

```python
from app.services.qdrant_migration import QdrantMigrationService

service = QdrantMigrationService()
result = service.migrate_existing_points()

print(f"Updated: {result['updated']}")
print(f"Skipped: {result['skipped']}")
print(f"Errors: {result['errors']}")
```

Der Service aktualisiert Qdrant Points folgendermaßen:
- Wenn Point `persona_id` hat → Hole Target Group aus Persona
- Wenn Point `persona_segment` hat → Finde Target Group via Segment
- Wenn Point `document_id` hat → Hole Persona → Hole Target Group
- Setze `target_group_id` im Qdrant Payload

### 3. API Endpunkte

#### Schemas & Verwendungen

- `POST /target-groups`
  - Request: `TargetGroupCreateRequest` (`apps/api/app/schemas/__init__.py`) erbt von `TargetGroupBase` und erwartet `project_id`, `name`, `segment`, optionale `description`.
  - Response: `TargetGroupResponse` (inkl. `personas: List[PersonaListItem]`, `knowledge_entries: List[PersonaKnowledgeEntry]`, `sources`).
  - Verwendung: Admin Console Formular `apps/web/app/admin/api-docs` sowie interne `TargetGroupService.create_target_group`.

- `GET /target-groups`
  - Response: `TargetGroupListResponse` → `items: List[TargetGroupListItem]` (enthält `persona_count`, `knowledge_entry_count`, Timestamps).
  - Verwendung: Listenansicht im Admin UI, Pagination-API für `TargetGroupService.list_target_groups`.

- `GET /target-groups/{id}`
  - Response: `TargetGroupResponse` (s.o.), nutzt verschachtelte `PersonaListItem` + `PersonaKnowledgeEntry`. `PersonaProfile` Felder folgen `knowledge/persona_schema.yaml`.
  - Verwendung: Detailseite Admin UI, Persona-Service für Kontextdaten.

- `PATCH /target-groups/{id}`
  - Request: `TargetGroupUpdateRequest` (optionale `name`, `description`, `segment`, `updated_by`).
  - Response: `TargetGroupResponse`.
  - Verwendung: Inline-Editing der Detailseite, `TargetGroupService.update_target_group`.

- `GET /target-groups/{id}/knowledge`
  - Response: `List[PersonaKnowledgeEntry]` (Felder `title`, `content`, `metadata`, `createdAt`, `createdBy`).
  - Verwendung: Knowledge-Tab im Admin UI, Feed für Retrieval-Agent.

- `POST /target-groups/{id}/knowledge`
  - Request: `TargetGroupKnowledgeUpsertRequest` (`title`, `content`, optionale `metadata`, `created_by` Default `system`).
  - Response: `PersonaKnowledgeEntry`.
  - Verwendung: Knowledge-Formular, `KnowledgeIngestionService`.

- `GET /target-groups/{id}/knowledge/chunks`
  - Response: `List[KnowledgeChunk]` (`document_id`, `document_filename`, `relevance_score`, optionale `metadata`, Visualisierungs-Placeholder `x,y,cluster_id`).
  - Verwendung: Knowledge Explorer Scatterplot, Input für `clusters` Endpoint.

- `GET /target-groups/{id}/knowledge/clusters`
  - Response: `ClusterResult` (`clusters: List[KnowledgeCluster]`, `chunks`, `coordinates_2d`, `cluster_labels`, `method`).
  - Verwendung: Visualisierung im Admin UI, Analytics für thematische Cluster.

- `GET /target-groups/{id}/knowledge/chunks/{chunk_id}/similar`
  - Response: `List[SimilarChunk]` (`id`, `content`, `similarity`, `document_id`).
  - Verwendung: Kontextpanel im Explorer zur semantischen Nachbarschaft.

**Quellen & Tests**
- Kanonische Schemas: `apps/api/app/schemas/__init__.py`.
- Persona-Felder: `knowledge/persona_schema.yaml`.
- Contract Tests: `tests/schema/test_persona_contract.py` + Target-Group API Tests in `apps/api/tests`.
- Beim Ändern von Schemas bitte oben genannte Dateien sowie Admin-UI Formulare synchron halten.

#### Target Groups

- `GET /target-groups`: Liste aller Target Groups (mit Pagination)
- `POST /target-groups`: Erstelle neue Target Group
- `GET /target-groups/{id}`: Details einer Target Group (inkl. Personas & Knowledge)
- `PATCH /target-groups/{id}`: Update Target Group
- `GET /target-groups/{id}/knowledge`: Liste Knowledge Entries
- `POST /target-groups/{id}/knowledge`: Erstelle Knowledge Entry

#### Personas (erweitert)

- `POST /personas`: Unterstützt jetzt `target_group_id` Parameter
- `POST /personas/generate`: Unterstützt Target Group basierte Generierung

### 4. Backward Compatibility

Die Architektur ist vollständig backward compatible:

- `segment` Feld bleibt erhalten in Personas
- Retrieval Agent unterstützt weiterhin `persona_segment` Parameter
- Qdrant Payload behält `persona_segment` neben `target_group_id`
- Existierende APIs funktionieren weiterhin

## Verwendung

### Target Group erstellen

```python
from app.schemas import TargetGroupCreateRequest
from app.services.target_group_store import TargetGroupService

service = TargetGroupService()
payload = TargetGroupCreateRequest(
    project_id="...",
    name="Enterprise Buyers",
    segment="enterprise",
    description="Enterprise customers"
)
target_group = service.create_target_group(session, payload)
```

### Persona mit Target Group erstellen

```python
from app.schemas import PersonaCreateRequest

payload = PersonaCreateRequest(
    project_id="...",
    name="Erik",
    segment="enterprise",
    headline="CFO",
    target_group_id=str(target_group.id)  # NEU
)
persona = persona_service.create_persona(session, payload)
```

### Persona mit Target Group Knowledge generieren

```python
from app.services.persona_generation import PersonaGenerationService

generator = PersonaGenerationService()
result = generator.generate(
    persona=persona,
    target_group_id=target_group.id,  # Hole Knowledge aus Target Group
    variation_params={"skepticism": 0.9, "tech_affinity": 0.3}  # Optional
)
```

### Retrieval mit Target Group

```python
from app.agents.retrieval import RetrievalAgent

agent = RetrievalAgent()
embedding, hits = agent.run(
    query="What do customers think about pricing?",
    target_group_id=str(target_group.id)  # Filter nach Target Group
)
```

## Architektur-Diagramm

```
Target Group (Enterprise Buyers)
├── Knowledge Entries (gemeinsam)
│   ├── Pain Points
│   ├── Goals
│   └── Business Context
├── Sources (Chunks)
│   └── Research-Daten
└── Personas
    ├── Erik (CFO, skeptisch)
    ├── Thomas (CTO, technikaffin)
    └── Claudia (CEO, business-fokussiert)
```

## Wichtige Hinweise

1. **Migration ist automatisch**: Alle existierenden Personas bekommen automatisch Target Groups basierend auf Segment
2. **Knowledge wird migriert**: Bestehende `PersonaKnowledgeEntry` werden zu `TargetGroupKnowledgeEntry` migriert
3. **Qdrant Update erforderlich**: Nach Datenbank-Migration sollte Qdrant Migration ausgeführt werden
4. **Segment bleibt**: `segment` Feld bleibt für Backward Compatibility erhalten

