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
    def _render_template(
        self, 
        template: str, 
        profile: PersonaProfile, 
        name: str, 
        segment: str, 
        traits_desc: str
    ) -> str:
        """
        Render template by replacing variables in both {{ }} and ${} formats.
        
        Supports variables:
        - name: Persona name
        - profession: Persona segment/profession
        - traits_desc: Personality traits description
        - persona_profile: Full profile as formatted text
        - bio: Persona biography
        - headline: Persona headline
        """
        import json
        
        # Build comprehensive profile text
        profile_parts = []
        profile_parts.append(f"Name: {name}")
        profile_parts.append(f"Profession: {segment}")
        if profile.headline:
            profile_parts.append(f"Headline: {profile.headline}")
        if profile.bio:
            profile_parts.append(f"Bio: {profile.bio}")
        if traits_desc:
            profile_parts.append(f"Traits: {traits_desc.strip()}")
        
        # Add goals if available
        if profile.goals:
            goals_text = ", ".join([g.label for g in profile.goals[:3]])
            profile_parts.append(f"Goals: {goals_text}")
        
        # Add pain points if available
        if profile.pain_points:
            pain_points_text = ", ".join([pp.label for pp in profile.pain_points[:3]])
            profile_parts.append(f"Pain Points: {pain_points_text}")
        
        persona_profile_text = "\\n".join(profile_parts)
        
        # Create variable mapping
        variables = {
            "name": name,
            "profession": segment,
            "traits_desc": traits_desc,
            "persona_profile": persona_profile_text,
            "bio": profile.bio or "",
            "headline": profile.headline or "",
        }
        
        rendered = template
        
        # Replace both {{ variable }} and ${variable} formats
        for var_name, var_value in variables.items():
            # Replace {{ variable }} format (Jinja2-style)
            rendered = rendered.replace(f"{{{{ {var_name} }}}}", var_value)
            # Replace ${variable} format (shell-style)
            rendered = rendered.replace(f"${{{var_name}}}", var_value)
        
        return rendered

    def _build_portrait_prompt(self, profile: PersonaProfile, project_id: str | None = None) -> str:
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
        
        # Try to fetch prompt template from DB
        # Priority: 1. Project override, 2. Global template, 3. Hardcoded fallback
        try:
            from ..db import SessionLocal
            from ..models import PromptTemplate
            from sqlalchemy import select
            
            with SessionLocal() as session:
                # First, check for project-specific override
                template_record = None
                if project_id:
                    try:
                        # Import AiTemplateOverride from api models
                        # Note: chat-api shares the same database but may not have all models imported
                        # We'll query it directly via SQL to avoid import issues
                        from uuid import UUID
                        from sqlalchemy import text
                        
                        project_uuid = UUID(project_id)
                        result = session.execute(
                            text("""
                                SELECT payload->>'prompt' as template, payload->>'version' as version
                                FROM audion.ai_template_overrides
                                WHERE project_id = :project_id AND template_id = :template_id
                                LIMIT 1
                            """),
                            {"project_id": str(project_uuid), "template_id": "persona_avatar"}
                        ).first()
                        
                        if result and result.template:
                            logger.info("persona_image.using_project_override", 
                                       project_id=project_id,
                                       template_version=result.version or "unknown",
                                       template_preview=result.template[:100])
                            
                            # Render the override template with all available variables
                            rendered = self._render_template(result.template, profile, name, segment, traits_desc)
                            
                            logger.info("persona_image.template_rendered", 
                                       source="project_override",
                                       rendered_preview=rendered[:200])
                            return rendered
                    except Exception as e:
                        logger.warning("persona_image.override_fetch_failed", 
                                      error=str(e), 
                                      project_id=project_id,
                                      exc_info=True)
                
                # Fallback to global template
                template_record = session.scalar(
                    select(PromptTemplate).where(PromptTemplate.name == "persona_avatar")
                )
                
                logger.info("persona_image.template_query_result", 
                           found=template_record is not None,
                           has_template=template_record.template if template_record else None)
                
                if template_record and template_record.template:
                    logger.info("persona_image.using_db_template", 
                               template_version=template_record.version,
                               template_preview=template_record.template[:100])
                    
                    # Log variable values for debugging
                    logger.info("persona_image.rendering_variables",
                               name=name,
                               segment=segment, 
                               traits_desc=traits_desc)
                    
                    # Render template with all available variables
                    rendered = self._render_template(template_record.template, profile, name, segment, traits_desc)
                    
                    logger.info("persona_image.template_rendered", 
                               source="global_template",
                               rendered_preview=rendered[:200])
                    
                    return rendered
                else:
                    logger.warning("persona_image.no_template_in_db", 
                                  template_name="persona_avatar")
        except Exception as e:
            logger.warning("persona_image.template_fetch_failed", error=str(e), exc_info=True)
            # Fallback to hardcoded default
        
        # Build comprehensive prompt (Default Fallback)
        logger.info("persona_image.using_fallback_prompt")
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
        self, profile: PersonaProfile, project_id: str | None = None, save_to_storage: bool = True
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
            prompt = self._build_portrait_prompt(profile, project_id=project_id)
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
