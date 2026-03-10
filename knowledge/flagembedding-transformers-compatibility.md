# FlagEmbedding and transformers compatibility

## Chat model (persona responses)

The persona chat (non-streaming `POST /chat/message` and voice stream) uses **OpenAI**. The model is configured in chat-api:

- **Config**: `apps/chat-api/app/core/config.py` → `chat_model` (default: `gpt-5-mini`).
- **Env**: Set `CHAT_MODEL` to override (e.g. `gpt-4o-mini` if gpt-5-mini is unavailable).
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

## References

- [FlagEmbedding #1266](https://github.com/FlagOpen/FlagEmbedding/issues/1266) – dependency on transformers version.
- Lazy import of FlagEmbedding is already used in `apps/chat-api/app/agents/retrieval.py` to avoid startup failures.
