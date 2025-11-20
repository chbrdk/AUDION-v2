# Persona-Quellen-Audit-Log

Jede Aktualisierung oder QA einer externen Persona-Quelle wird hier als Markdown-Datei (`YYYY-MM-DD-<source-id>.md`) abgelegt. Pflichtfelder:

- **Source ID**
- **Datum / Zeit**
- **Aktion** (z.B. Initial Import, Refresh, QA, De-Scope)
- **Checksum / Version Tag**
- **Prüfschritte** (Schema-Validierung, Bias-Scan, Lizenzcheck)
- **Ergebnis & Maßnahmen**

## Beispielvorlage

```
Source ID: persona_src_synthlabsai
Datum: 2025-11-20
Aktion: Initial Import
Checksum: hf://SynthLabsAI/PERSONA@abcdef123456
Prüfschritte:
- Schema-Abgleich mit `knowledge/persona_schema.yaml`
- Stichprobe 200 Datensätze → PII-Scan
- Lizenzprüfung CC BY 4.0
Ergebnis:
- Keine PII gefunden
- Felder `preferences.detail` optional → Mapping aktualisieren
Maßnahmen:
- Weighting-Trust auf 0.75 gesetzt
- Nächster QA-Zyklus: 2025-12-20
```

> Hinweis: Für interne Datensätze bitte ebenfalls Audits erfassen, damit die höhere Wertigkeit nachvollziehbar bleibt.

