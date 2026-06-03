# Persona moodboard — generation quality & roadmap

## Implemented (2026-06)

- **8 categories:** lifestyle, places, colors, textures, people, objects, ui, typography
- **Style package** (`moodboard_creative.py`): mood manifest, keywords, palette hints, per-category directions, avoid-list (anti stock/AI slop)
- **Stock:** one scored tile per category (not 4×6 flood)
- **OpenAI:** art-directed prompts from brief + avoid list; captions/rationale on tiles
- **API:** `moodManifest`, `paletteHints` on moodboard payload
- **UI:** manifest + palette chips in atmosphere block (`MsqdxGlassPersonaMoodboardSection`)

## Product ideas (next)

| Idea | Why it helps uniqueness |
|------|-------------------------|
| **Dominant-color swatches** from final tiles | Real palette from persona board, not text hints |
| **Sound grain / ambient loop** (short, licensed or gen) | Mood beyond visuals; optional mute in UI |
| **Typography specimen tile** as real type sample image | Not generic “font” stock |
| **Places tied to persona geography** | Cities/routes from profile, not random travel stock |
| **Locked tiles on rebuild** | User-curated anchors; regen only open slots |
| **Hybrid per category** | Stock for textures/places, gen for people/ui when stock scores low |
| **Reference upload** | User drops 1–3 refs; brief cites them (no clone faces) |
| **Collage export** | Single shareable board PNG/PDF for decks |
| **Duplicate detection** | Hash/similarity across personas in same project |

## Anti-slop principles

1. Brief from full persona signals (traits, pains, tone, goals), not interests-only
2. Explicit `avoid` in every image prompt and stock scoring
3. One strong tile per category vs. volume of mediocre matches
4. Show **manifest + rationale** in UI so the board feels authored, not random
