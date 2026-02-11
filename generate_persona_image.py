#!/usr/bin/env python3
"""Script to generate an image for an existing persona."""

import sys
import os

# Add the chat-api app to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "apps", "chat-api"))

from app.db import get_session
from app.models import Persona
from app.services.persona_image import PersonaImageService
from sqlalchemy import select
from msqdx_glass_proto import PersonaProfile
from datetime import datetime

def find_ebike_persona():
    """Find the ebike persona."""
    with get_session() as session:
        # Search for personas with "ebike" in segment or name
        query = select(Persona).where(
            (Persona.segment.ilike("%ebike%")) | (Persona.name.ilike("%ebike%"))
        )
        personas = session.scalars(query).all()
        
        if not personas:
            print("No ebike persona found. Available personas:")
            all_personas = session.scalars(select(Persona)).all()
            for p in all_personas:
                print(f"  - {p.name} ({p.segment}) - ID: {p.id}")
            return None
        
        if len(personas) > 1:
            print(f"Found {len(personas)} personas matching 'ebike':")
            for p in personas:
                print(f"  - {p.name} ({p.segment}) - ID: {p.id}")
            print("\nUsing the first one...")
        
        return personas[0]

def generate_image_for_persona(persona: Persona):
    """Generate an image for the given persona."""
    print(f"Generating image for persona: {persona.name} ({persona.segment})")
    
    # Convert persona to PersonaProfile
    profile_dict = persona.profile if isinstance(persona.profile, dict) else {}
    profile = PersonaProfile(
        id=str(persona.id),
        name=persona.name,
        segment=persona.segment,
        headline=persona.headline,
        bio=profile_dict.get("bio", ""),
        traits=profile_dict.get("traits", {}),
        pain_points=profile_dict.get("pain_points", []),
        goals=profile_dict.get("goals", []),
        communication_style=profile_dict.get("communication_style", {}),
        confidence=persona.confidence,
        version=persona.version,
        created_at=persona.created_at.isoformat(),
    )
    
    # Generate image
    image_service = PersonaImageService()
    image_url = image_service.generate_portrait(profile, save_to_storage=True)
    
    if not image_url:
        print("Failed to generate image")
        return False
    
    # Update persona with image URL
    with get_session() as session:
        persona = session.get(Persona, persona.id)
        if persona:
            persona.image_url = image_url
            persona.image_generated_at = datetime.utcnow()
            session.commit()
            print("Success! Image URL saved to persona.")
            print(f"Image URL (first 100 chars): {image_url[:100]}...")
            return True
    
    return False

if __name__ == "__main__":
    persona = find_ebike_persona()
    if persona:
        success = generate_image_for_persona(persona)
        sys.exit(0 if success else 1)
    else:
        print("No ebike persona found.")
        sys.exit(1)

