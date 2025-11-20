# Internal Insights

Speicherort für Interview-, Survey- und Analytics-Snippets im JSONL-Format.

Schema pro Zeile:

```
{
  "insight_id": "ins-2025-11-001",
  "persona_id": "persona_src_internal_research:2025-11-a1",
  "type": "interview|survey|analytics",
  "summary": "...",
  "evidence_date": "2025-11-18T09:00:00Z"
}
```

Diese Daten werden von `PersonaEnrichmentPipeline` konsumiert.

