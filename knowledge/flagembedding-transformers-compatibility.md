# FlagEmbedding and transformers compatibility

## Chat model (persona responses)

The persona chat (non-streaming `POST /chat/message` and voice stream) uses **OpenAI**. The model is configured in chat-api:

- **Config**: `apps/chat-api/app/core/config.py` → `chat_model` (default: `gpt-5-nano`).
- **Env**: Set `CHAT_MODEL` to override (e.g. `gpt-5-mini`, `gpt-4o-mini`).
- **Usage**: `apps/chat-api/app/routers/chat.py` and `apps/chat-api/app/routers/voice.py` use `settings.chat_model`.

---

# FlagEmbedding and transformers compatibility

## Problem

FlagEmbedding 1.3.5 depends on Hugging Face `transformers`. Newer transformers versions removed `is_torch_fx_available` from `transformers.utils.import_utils`, causing:

```
cannot import name 'is_torch_fx_available' from 'transformers.utils.import_utils'
```

## Fix (chat-api)

1. **Pin transformers** in `apps/chat-api/pyproject.toml` to a compatible version:
   - `transformers==4.44.2` (recommended in FlagEmbedding issues).

2. **Graceful fallback**: If retrieval fails (e.g. wrong transformers in environment), chat and voice continue without sources instead of returning 500:
   - `apps/chat-api/app/routers/chat.py`: on retrieval exception, log warning and use empty `sources`.
   - `apps/chat-api/app/routers/voice.py`: same for stream; yield empty sources and continue.

## Qdrant 401 "Must provide an API key or an Authorization bearer token"

If retrieval fails with **401 Unauthorized** and that message, the Qdrant instance (e.g. Qdrant Cloud) requires an API key. The chat-api must send it:

- **Config**: `apps/chat-api/app/core/config.py` → `qdrant_api_key: str | None = None`
- **Env**: Set `QDRANT_API_KEY` to your Qdrant API key (e.g. from Qdrant Cloud dashboard).
- **Usage**: `RetrievalAgent` and `PersonaDiscoveryService` pass `api_key=settings.qdrant_api_key` into `QdrantClient`. If unset, no key is sent (for local Qdrant without auth).

In `docker-compose.yml`, chat-api has `QDRANT_API_KEY=${QDRANT_API_KEY:-}` so you can set it in the host env or in Coolify.

---

## References

- [FlagEmbedding #1266](https://github.com/FlagOpen/FlagEmbedding/issues/1266) – dependency on transformers version.
- Lazy import of FlagEmbedding is already used in `apps/chat-api/app/agents/retrieval.py` to avoid startup failures.
