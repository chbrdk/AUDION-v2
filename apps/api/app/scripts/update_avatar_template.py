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
        
        # Update with new distinctive text
        new_template_text = """Create a photorealistic professional headshot of {{ name }}, who works as {{ profession }}.{{ traits_desc }} The portrait should feature: warm and inviting lighting, subtle depth of field with a softly blurred background, contemporary professional attire, confident yet approachable expression, high-resolution detail, magazine-quality photography."""
        
        print(f"📝 Old template: {template.template[:100]}...")
        template.template = new_template_text
        session.commit()
        print(f"✅ Updated template: {template.template[:100]}...")
        print("✅ Template updated successfully!")
        
    finally:
        session.close()

if __name__ == "__main__":
    update_template()
