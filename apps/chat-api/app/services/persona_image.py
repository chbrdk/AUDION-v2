from __future__ import annotations

import base64
from typing import Optional

import httpx
import structlog
from openai import OpenAI
from msqdx_glass_proto import PersonaProfile

from ..core.config import get_settings

logger = structlog.get_logger(__name__)
settings = get_settings()


class PersonaImageService:
    """Service for generating persona portrait images using OpenAI image-1."""

    def __init__(self) -> None:
        self._client = OpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None
        if not self._client:
            logger.warning("persona_image.openai_api_key_not_set")

    def _build_portrait_prompt(self, profile: PersonaProfile) -> str:
        """Build a detailed prompt for realistic portrait generation."""
        # Extract demographic information from bio and segment
        name = profile.name
        segment = profile.segment
        
        # Extract traits for personality description
        traits_desc = ""
        if profile.traits:
            trait_list = []
            for trait_name, score in profile.traits.items():
                if score > 0.6:
                    trait_list.append(trait_name)
            if trait_list:
                traits_desc = f" They appear {', '.join(trait_list[:3])}."
        
        # Try to fetch global prompt template from DB
        try:
            from ..db import SessionLocal
            from ..models import PromptTemplate
            from sqlalchemy import select
            
            with SessionLocal() as session:
                template_record = session.scalar(
                    select(PromptTemplate).where(PromptTemplate.name == "persona_avatar")
                )
                
                if template_record and template_record.template:
                    logger.info("persona_image.using_db_template", template_version=template_record.version)
                    # Simple string replacement for template rendering (avoiding jinja2 dependency)
                    # The template expects {{ name }}, {{ profession }}, {{ traits_desc }}
                    rendered = template_record.template
                    rendered = rendered.replace("{{ name }}", name)
                    rendered = rendered.replace("{{ profession }}", segment) # segment maps to profession hint
                    rendered = rendered.replace("{{ traits_desc }}", traits_desc)
                    # Handle any other variables if added in future by just leaving them or basic replace
                    return rendered
        except Exception as e:
            logger.warning("persona_image.template_fetch_failed", error=str(e))
            # Fallback to hardcoded default
        
        # Build comprehensive prompt (Default Fallback)
        profession_hint = segment
        prompt = (
            f"A professional portrait photograph of {name}, "
            f"a {profession_hint}.{traits_desc} "
            f"Professional business portrait, studio lighting, "
            f"neutral gray background, high quality, realistic, "
            f"head and shoulders, looking directly at camera, natural expression, "
            f"professional business attire."
        )
        
        return prompt

    def generate_portrait(
        self, profile: PersonaProfile, save_to_storage: bool = True
    ) -> Optional[str]:
        """
        Generate a portrait image for a persona.
        
        Args:
            profile: The persona profile to generate an image for
            save_to_storage: Whether to download and save the image to storage
            
        Returns:
            URL to the generated image, or None if generation failed
        """
        if not self._client:
            logger.error("persona_image.api_key_missing")
            return None

        try:
            prompt = self._build_portrait_prompt(profile)
            logger.info("persona_image.generating", persona_id=profile.id, prompt_preview=prompt[:100])

            # Call OpenAI Image API (gpt-image-1-mini model)
            response = self._client.images.generate(
                model="gpt-image-1-mini",
                prompt=prompt,
                size="1024x1024",
                quality="high",
                n=1,
            )

            # OpenAI returns a URL to the generated image
            # Check response structure - it might be response.data[0].url or response.data[0].b64_json
            logger.info("persona_image.response_structure", response_type=type(response).__name__, has_data=hasattr(response, 'data'), data_len=len(response.data) if hasattr(response, 'data') and response.data else 0)
            
            if not response.data or len(response.data) == 0:
                logger.error("persona_image.no_image_in_response", persona_id=profile.id, response=str(response)[:200])
                return None
            
            image_data = response.data[0]
            image_url = getattr(image_data, "url", None)
            b64_json = getattr(image_data, "b64_json", None)

            if not image_url and not b64_json:
                logger.error("persona_image.no_image_in_response", persona_id=profile.id, image_data_attrs=dir(image_data))
                return None

            # Get image bytes: from URL (download) or from b64_json (decode)
            if b64_json:
                try:
                    image_bytes = base64.b64decode(b64_json)
                except Exception as e:
                    logger.error("persona_image.b64_decode_failed", error=str(e), persona_id=profile.id)
                    return None
            else:
                try:
                    image_response = httpx.get(image_url, timeout=30.0)
                    image_response.raise_for_status()
                    image_bytes = image_response.content
                except Exception as e:
                    logger.error("persona_image.download_failed", error=str(e), persona_id=profile.id)
                    return None

            # If save_to_storage, build data URL (or future: upload to S3) and return it
            if save_to_storage:
                try:
                    saved_url = self._save_image(profile.id, image_bytes)
                    logger.info("persona_image.saved", persona_id=profile.id, url_preview=saved_url[:50] if saved_url else None)
                    return saved_url
                except Exception as e:
                    logger.error("persona_image.save_failed", error=str(e), persona_id=profile.id)
                    return f"data:image/png;base64,{base64.b64encode(image_bytes).decode('utf-8')}" if image_bytes else None
            else:
                return f"data:image/png;base64,{base64.b64encode(image_bytes).decode('utf-8')}" if image_bytes else None

        except Exception as e:
            logger.error("persona_image.generation_failed", error=str(e), persona_id=profile.id, exc_info=True)
            return None

    def _save_image(self, persona_id: str, image_bytes: bytes) -> str:
        """
        Save image to storage and return URL.
        
        For now, returns a data URL. In production, this should:
        - Save to S3 or similar cloud storage
        - Or save to a public directory and serve via web server
        - Return a permanent URL
        """
        # For now, return data URL as base64 encoded image
        # This works but is not ideal for production
        # TODO: Implement proper storage (S3, local filesystem with public serving, etc.)
        image_base64 = base64.b64encode(image_bytes).decode('utf-8')
        return f"data:image/png;base64,{image_base64}"
