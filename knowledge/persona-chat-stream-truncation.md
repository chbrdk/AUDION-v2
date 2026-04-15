# Persona-Chat: Antwort bricht nach ~Hälfte ab (Streaming)

## Ursache

Der Chat-API-Endpunkt `POST /message/stream` baut SSE-Deltas mit `emit_sanitized_delta`: Der bisherige Roh-Text wird bei jedem Chunk durch `clean_response_text()` geschickt und nur der **neue** Anteil als Delta an das Frontend geschickt.

`clean_response_text` hatte standardmäßig **`max_paragraphs=2`**. Ab dem dritten Absatz wurde der bereinigte Text also hart gekürzt. Zusammen mit der inkrementellen Delta-Logik führte das zu falsch zusammengesetztem oder fehlendem sichtbaren Text im Einzel-Persona-Chat.

## Fix

Beim Streaming wird `clean_response_text(..., max_paragraphs=None)` verwendet (kein Absatzlimit). Das kurze 2-Absatz-Limit bleibt für den **nicht-streaming**-Pfad in `chat.py` erhalten, wo es bewusst für Kürze genutzt wird.

Betroffene Dateien: `apps/chat-api/app/utils/text.py`, `apps/chat-api/app/routers/chat.py`, `apps/chat-api/app/routers/voice.py`.

## Tests

`apps/chat-api/tests/test_clean_response_text.py` prüft das Absatzlimit und die Streaming-Delta-Simulation.

## Clients

- **Web** (`/chat`, `/admin/chat`): nutzt bereits `POST …/message/stream`.
- **PowerPoint- und Figma-Plugin**: `sendMessage` ruft ebenfalls `AUDION_CHAT_MESSAGE_STREAM_PATH` auf und baut am Ende dasselbe Ergebnis wie früher `POST …/message` (Antwort erscheint weiterhin erst wenn der Stream fertig ist; technisch läuft aber immer derselbe Stream-Endpunkt wie im Web).

## Backend: ein Generator, zwei Endpunkte

`POST /chat/message` (JSON) und `POST /chat/message/stream` (SSE) teilen sich dieselbe Pipeline:

- `build_chat_stream_context` lädt Prompt und baut `anthropic_messages`.
- `iter_chat_sse` in `apps/chat-api/app/routers/chat_stream.py` erzeugt die SSE-Zeilen.
- JSON: `collect_chat_message_response` iteriert `iter_chat_sse` und setzt `response` + `sources` zusammen.

Damit entfallen die doppelte Non-Streaming-LLM-Logik und abweichende Bereinigung (z. B. früher `max_paragraphs=2` nur auf JSON).
