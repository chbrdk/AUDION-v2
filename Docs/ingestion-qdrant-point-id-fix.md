# Ingestion Qdrant Point ID Fix

## Problem

Die Ingestion schlug fehl mit folgendem Fehler:

```
UnexpectedResponse: Unexpected Response: 400 (Bad Request)
Raw response content:
b'{"status":{"error":"Format error in JSON body: value 
1181371d-33ab-4fa5-93dd-584bc40dedf4-0 is not a valid point ID, valid values are
either an unsigned integer or a UUID"},"time":0.0}'
```

## Ursache

In `apps/api/app/services/ingestion.py` wurde die Point-ID für Qdrant als zusammengesetzter String generiert:

```python
id=f"{document_id}-{idx}"  # ❌ Nicht erlaubt
```

Qdrant akzeptiert jedoch nur:
- UUIDs (z.B. `"1181371d-33ab-4fa5-93dd-584bc40dedf4"`)
- Unsigned Integers (z.B. `12345`)

**NICHT** zusammengesetzte Strings wie `"1181371d-33ab-4fa5-93dd-584bc40dedf4-0"`.

## Lösung

Die `chunk_id` (die bereits eine UUID ist) wird jetzt direkt als Point-ID verwendet:

```python
id=chunk_id,  # ✅ UUID vom DocumentChunk
```

## Änderungen

- **Datei**: `apps/api/app/services/ingestion.py`
- **Zeile**: ~160
- **Änderung**: `id=f"{document_id}-{idx}"` → `id=chunk_id`

## Testing

Nach dem Fix sollte die Ingestion erfolgreich durchlaufen und die Chunks in Qdrant speichern können.

