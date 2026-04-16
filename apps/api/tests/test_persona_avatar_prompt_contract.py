"""Ensure persona avatar image prompt stays persona-specific (sync with chat-api)."""

from __future__ import annotations

from pathlib import Path


def test_chat_api_persona_image_service_has_rich_default_prompt() -> None:
    """Contract: default avatar prompt must push environmental/lifestyle variety, not stock business only."""
    root = Path(__file__).resolve().parents[2]
    path = root / "chat-api" / "app" / "services" / "persona_image.py"
    text = path.read_text(encoding="utf-8")
    assert "DEFAULT_PERSONA_AVATAR_IMAGE_TEMPLATE" in text
    assert "ENVIRONMENTAL" in text or "LIFESTYLE" in text
    assert "business headshot" in text.lower() or "stock" in text.lower()
    assert "profile_dict" in text
    assert "_visual_story_for_image" in text


def test_alembic_migration_persona_avatar_v2_exists() -> None:
    path = Path(__file__).resolve().parents[1] / "alembic" / "versions" / "20260417_persona_avatar_prompt_v2.py"
    text = path.read_text(encoding="utf-8")
    assert "20260417_persona_avatar_v2" in text
    assert "ON CONFLICT (name)" in text
    assert "persona_avatar" in text


def test_seed_prompts_persona_avatar_mentions_rich_portrait() -> None:
    path = Path(__file__).resolve().parents[1] / "app" / "scripts" / "seed_prompts.py"
    text = path.read_text(encoding="utf-8")
    assert "persona_avatar" in text
    assert "{{ persona_profile }}" in text
    assert "ENVIRONMENTAL" in text
