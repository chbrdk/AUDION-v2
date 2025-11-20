# Persona Mapping Files

Dieses Verzeichnis enthält YAML-Mappings, die externe Quellfelder auf das kanonische Schema (`knowledge/persona_schema.yaml`) abbilden.

## Konventionen

- Dateiname: `<source_id>.yaml` (z.B. `persona_src_synthlabsai.yaml`).
- Jede Datei besteht aus:
  - `source`: Referenz auf Quelle + Version.
  - `defaults`: Fallback-Werte für Pflichtfelder.
  - `field_map`: Zuordnung `schema_field -> source_expression`.
  - `transformers`: Optionale Python-Funktionen (by name) die in `pipelines/persona_transform.py` implementiert sind.
- Keine harten URLs oder Secrets speichern – nur Source IDs.

> Änderungen an den Mappings müssen zusammen mit Tests (`tests/mappings/`) erfolgen.

