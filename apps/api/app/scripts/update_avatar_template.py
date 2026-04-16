#!/usr/bin/env python3
"""Update persona_avatar template in database"""
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.db import SessionLocal
from app.models import PromptTemplate
from sqlalchemy import select

def update_template():
    session = SessionLocal()
    try:
        # Find existing template
        template = session.scalar(
            select(PromptTemplate).where(PromptTemplate.name == "persona_avatar")
        )
        
        if not template:
            print("❌ Template 'persona_avatar' not found in database")
            return
        
        # Keep in sync with apps/chat-api/app/services/persona_image.py DEFAULT_PERSONA_AVATAR_IMAGE_TEMPLATE
        new_template_text = """Photorealistic single-person portrait for a UX persona card.

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
        
        print(f"📝 Old template: {template.template[:100]}...")
        template.template = new_template_text
        session.commit()
        print(f"✅ Updated template: {template.template[:100]}...")
        print("✅ Template updated successfully!")
        
    finally:
        session.close()

if __name__ == "__main__":
    update_template()
