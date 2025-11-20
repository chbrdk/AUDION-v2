# Persona Index Storage

Ziel-Location für harmonisierte Personas (JSONL + Vektorstore). Standardstruktur:

```
storage/persona_index/
  metadata/
  vectors/
  manifests/
```

- Pfad wird über `PERSONA_INDEX_ROOT` steuerbar gemacht.
- Schreibzugriffe ausschließlich über `pipelines/persona_transform.py` oder `pipelines/persona_enrich.py`.

