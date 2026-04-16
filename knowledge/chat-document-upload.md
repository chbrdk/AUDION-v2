# Chat: DOCX-Anhänge (Admin)

## Endpunkt

- `POST /chat/documents/upload` — multipart Feld `file`, nur **`.docx`**. Legacy **`.doc`** → `415` mit Hinweis, als DOCX zu speichern.
- Response: `{ document_id, filename, char_count, truncated?, expires_in_seconds }`.

## Nutzung im Chat

- User-Nachrichten im JSON-Body von `/chat/message/stream` (und Voice `/voice/chat/stream`) können **`document_ids: string[]`** tragen (neben `image_ids`).
- Der Server merged extrahierten Text **vor** der Vision-Konvertierung in den sichtbaren User-Text; **Retrieval / Turn-Naturalness** nutzen weiterhin das **rohe** `content`-Feld (ohne Dokument-Prefix).

## Speicher & Limits

- In-Memory wie Bilder; TTL über **`upload_attachment_ttl_seconds`** (Default 3600), gemeinsam mit Image-Store-Cleanup in `images.py`.
- **`upload_max_document_bytes`** (Default 15 MB), **`upload_max_document_chars`** (Default 200k) für Extraktion inkl. Truncate-Hinweis `[… truncated]`.

## Frontend

- Admin Journey-Dialog → Tab **Attachments**: zweite Zone „Word (.docx)“; Upload-URL über `buildChatDocumentsUploadUrl` in `apps/web/app/api/_lib/backend.ts`.

## WebSocket

- Der WS-Persona-Pfad (`ws/chat.py`) unterstützt **keine** `document_ids` in v1.
