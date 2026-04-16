import logging
import os
import sys

from sqlalchemy import select
from sqlalchemy.orm import Session

# Add the parent directory to sys.path to allow importing from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.db import SessionLocal
from app.models import PromptTemplate

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def seed_prompts():
    session = SessionLocal()
    try:
        # Define default prompts
        prompts = [
            {
                "name": "persona_avatar",
                "version": "2.0",
                "description": "Persona-specific photorealistic portrait (avoid generic stock business headshots)",
                "input_variables": [
                    "name",
                    "profession",
                    "traits_desc",
                    "persona_profile",
                    "visual_brief",
                    "bio",
                    "headline",
                ],
                "template": """Photorealistic single-person portrait for a UX persona card.

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

Output: one high-quality photographic image.""",
            }
        ]

        for prompt_data in prompts:
            logger.info(f"Seeding prompt: {prompt_data['name']}")
            
            # Check if prompt exists
            existing = session.scalar(
                select(PromptTemplate).where(PromptTemplate.name == prompt_data['name'])
            )
            
            if existing:
                logger.info(f"Prompt {prompt_data['name']} already exists. Skipping.")
                # Optional: Update if needed, but for now we skip to preserve manual edits
                continue
            
            # Create new prompt
            new_prompt = PromptTemplate(
                name=prompt_data['name'],
                template=prompt_data['template'],
                description=prompt_data['description'],
                input_variables=prompt_data['input_variables'],
                version=prompt_data['version']
            )
            session.add(new_prompt)
        
        session.commit()
        logger.info("Prompt seeding completed successfully.")
        
    except Exception as e:
        logger.error(f"Failed to seed prompts: {e}")
        session.rollback()
        sys.exit(1)
    finally:
        session.close()

if __name__ == "__main__":
    seed_prompts()
