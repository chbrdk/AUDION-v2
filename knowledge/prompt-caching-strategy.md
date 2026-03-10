# Prompt Caching Strategy

## Overview

AI prompts are split into a **cacheable prefix** and a **variable suffix** so that providers (Anthropic, OpenAI) can cache the stable part and reduce latency/cost on repeated calls.

## Where It's Implemented

- **Service:** `apps/api/app/services/ai_assist.py`
- **Config:** `TEMPLATE_CACHE_PREFIX_LAST_VAR` – map of `template_id` → last context variable that ends the cacheable prefix.
- **Schema:** `apps/api/app/schemas/ai.py` – `AiTemplateDefinition.cache_prefix_last_variable` (optional, can be set in YAML).

## How It Works

1. For each request, the service checks whether the template has a cache boundary: either `template.cache_prefix_last_variable` (from YAML) or `TEMPLATE_CACHE_PREFIX_LAST_VAR.get(template_id)`.
2. The prompt text is split after the **last occurrence** of `${cache_prefix_last_variable}` in the template. The part before (inclusive) is the **prefix**, the rest is the **suffix**. Both are rendered with the full context.
3. **Anthropic:** The prefix is sent as a content block with `cache_control: { "type": "ephemeral" }`, the suffix as a second block. This enables Anthropic prompt caching.
4. **OpenAI:** Prefix and suffix are concatenated (prefix first) into a single user message so that prefix-first caching can apply where supported.

## Templates Using Caching (Code Map)

- `journey.full_generation` → `knowledge_context`
- `persona.pain_points` → `persona_profile`
- `persona.goals` → `persona_profile`
- `persona.interests` → `persona_profile`
- `persona.values` → `persona_profile`

## Optional YAML Override

In `apps/api/app/prompts/templates.yaml`, a template can set:

```yaml
cache_prefix_last_variable: knowledge_context
```

If set, this overrides the code map for that template. Example: `journey.full_generation` declares it in YAML.

## Tests

- `apps/api/tests/test_ai_assist_service.py`: `test_render_prompt_prefix_suffix_*` and `test_template_cache_prefix_map_*` cover the split logic and the map.

## References

- Plan: `.cursor/plans/prompt_caching_strategy_2e24544b.plan.md` (evaluation + optimization).
