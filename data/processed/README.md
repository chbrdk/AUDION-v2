# Processed Persona Data

Ausgabe der Transformations-Pipeline. Struktur:

```
data/processed/<source_id>/<batch_id>/personas.jsonl
```

- Enthält bereits das kanonische Schema.
- Wird anschließend in den Feature Store / Vektorindex geschrieben.
- Jede Datei muss ein zugehöriges QA-Protokoll besitzen.

