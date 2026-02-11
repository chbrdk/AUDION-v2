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
                "version": "1.0",
                "description": "Prompt for generating realistic persona portraits using DALL-E",
                "input_variables": ["name", "profession", "traits_desc"],
                "template": """A professional portrait photograph of {{ name }}, a {{ profession }}.{{ traits_desc }} Professional business portrait, studio lighting, neutral gray background, high quality, realistic, head and shoulders, looking directly at camera, natural expression, professional business attire."""
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
