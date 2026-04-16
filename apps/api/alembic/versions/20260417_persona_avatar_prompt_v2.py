"""Upsert persona_avatar prompt template (richer, persona-specific image brief).

Revision ID: 20260417_persona_avatar_v2
Revises: 20260416_journey_emotion_text
Create Date: 2026-04-17

Keeps chat-api `persona_image.DEFAULT_PERSONA_AVATAR_IMAGE_TEMPLATE` and DB row in sync for all environments.
"""

from __future__ import annotations

import json
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "20260417_persona_avatar_v2"
down_revision: Union[str, None] = "20260416_journey_emotion_text"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_PERSONA_AVATAR_TEMPLATE_V2 = """Photorealistic single-person portrait for a UX persona card.

CRITICAL: Avoid generic stock "business headshot" (plain gray seamless, blazer, catalog smile). The environment, wardrobe, props, lighting, and mood MUST follow the persona brief below.

Representing display name: {{ name }}.

PERSONA BRIEF (primary source — translate into concrete visuals)
---------------------------------------------------------------
{{ persona_profile }}

ADDITIONAL PERSONALITY HINTS
----------------------------
{{ traits_desc }}

COMPOSITION & STYLE
- One adult; natural skin texture; eyes sharp; respectful depiction; no caricature.
- Prefer ENVIRONMENTAL or LIFESTYLE context (workspace, home office, café, lab, workshop, street, hobby space, kitchen table…) that plausibly matches profession, interests, and bio — NOT a default lobby or passport booth unless the brief clearly implies it.
- Wardrobe and grooming match the role and values described (creative, technical, trade, care, executive, student, etc.).
- Lighting: natural window light, soft cinematic, or motivated practicals — avoid flat flash unless it fits the story.
- Framing: waist-up or three-quarter; contextual background with gentle bokeh; candid or semi-candid pose; expression aligned with dominant traits and pain points.

HARD CONSTRAINTS
- No text, logos, watermarks, UI, subtitles, extra faces, crowd as subject.
- High detail, believable materials, photographic (not illustration).

Output: one high-quality photographic image."""

_DESCRIPTION_V2 = "Persona-specific photorealistic portrait (avoid generic stock business headshots)"

_INPUT_VARIABLES_V2 = [
    "name",
    "profession",
    "traits_desc",
    "persona_profile",
    "visual_brief",
    "bio",
    "headline",
]

# Previous default (v1) for downgrade only.
_PERSONA_AVATAR_TEMPLATE_V1 = (
    "Create a photorealistic professional headshot of {{ name }}, who works as {{ profession }}."
    "{{ traits_desc }} The portrait should feature: warm and inviting lighting, subtle depth of field "
    "with a softly blurred background, contemporary professional attire, confident yet approachable expression, "
    "high-resolution detail, magazine-quality photography."
)


def upgrade() -> None:
    bind = op.get_bind()
    vars_json = json.dumps(_INPUT_VARIABLES_V2)
    bind.execute(
        text(
            """
            INSERT INTO audion.prompt_templates (
                id, name, template, description, input_variables, version, created_at, updated_at
            )
            VALUES (
                gen_random_uuid(),
                'persona_avatar',
                :tpl,
                :dsc,
                CAST(:vars AS jsonb),
                '2.0',
                NOW(),
                NOW()
            )
            ON CONFLICT (name) DO UPDATE SET
                template = EXCLUDED.template,
                description = EXCLUDED.description,
                input_variables = EXCLUDED.input_variables,
                version = EXCLUDED.version,
                updated_at = EXCLUDED.updated_at
            """
        ),
        {
            "tpl": _PERSONA_AVATAR_TEMPLATE_V2,
            "dsc": _DESCRIPTION_V2,
            "vars": vars_json,
        },
    )


def downgrade() -> None:
    bind = op.get_bind()
    vars_v1 = json.dumps(["name", "profession", "traits_desc"])
    bind.execute(
        text(
            """
            UPDATE audion.prompt_templates
            SET
                template = :tpl,
                description = :dsc,
                input_variables = CAST(:vars AS jsonb),
                version = '1.0',
                updated_at = NOW()
            WHERE name = 'persona_avatar'
            """
        ),
        {
            "tpl": _PERSONA_AVATAR_TEMPLATE_V1,
            "dsc": "Prompt for generating realistic persona portraits using DALL-E",
            "vars": vars_v1,
        },
    )
