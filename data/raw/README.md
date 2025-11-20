# Raw Persona Data

Zeitgestempelte Downloads der externen Quellen. Dateien werden pro Source-ID abgelegt:

```
data/raw/<source_id>/<YYYYMMDD-HHMMSS>/
```

- Keine Bearbeitungen in-place.
- Checksums und QA-Notizen im Audit-Log (`knowledge/persona_source_audits/`).
- Aufbewahrungsfrist derzeit 90 Tage; ältere Batches archivieren oder löschen.

