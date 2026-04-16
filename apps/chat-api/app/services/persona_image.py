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

# Default when DB has no `persona_avatar` template. Keep in sync with apps/api seed_prompts / update_avatar_template.
DEFAULT_PERSONA_AVATAR_IMAGE_TEMPLATE = """Photorealistic single-person portrait for a UX persona card.

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


class PersonaImageService:
    """Service for generating persona portrait images using OpenAI image-1."""

    def __init__(self) -> None:
        self._client = OpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None
        if not self._client:
            logger.warning("persona_image.openai_api_key_not_set")

    @staticmethod
    def _visual_story_for_image(profile: PersonaProfile, profile_dict: dict | None, traits_desc: str) -> str:
        """Short directive the image model can follow to avoid generic corporate portraits."""
        parts: list[str] = []
        parts.append(
            "IMAGE GOAL: A single believable person in a setting and outfit that match their real-life role, "
            "hobbies, and biography — not a stock-photo executive on gray seamless."
        )
        if profile.segment:
            parts.append(f"Role / segment anchor: {profile.segment}.")
        if profile.headline:
            parts.append(f"Public angle: {profile.headline}.")
        if profile.bio:
            excerpt = (profile.bio[:500] + "…") if len(profile.bio) > 500 else profile.bio
            parts.append(f"Lifestyle & context to echo (from bio): {excerpt}")
        pd = profile_dict or {}
        interests = pd.get("interests") or getattr(profile, "interests", None) or []
        if isinstance(interests, list) and interests:
            parts.append(f"Possible props / background cues from interests: {', '.join(str(i) for i in interests[:10])}.")
        values = pd.get("values") or getattr(profile, "values", None) or []
        if isinstance(values, list) and values:
            parts.append(f"Mood implied by values: {', '.join(str(v) for v in values[:6])}.")
        if profile.pain_points:
            pp = ", ".join(pp.label for pp in profile.pain_points[:4])
            parts.append(f"Subtle tension in expression or posture (pain points): {pp}.")
        if profile.goals:
            gg = ", ".join(g.label for g in profile.goals[:4])
            parts.append(f"Aspirational cues (goals): {gg}.")
        if profile.communication_style:
            if profile.communication_style.sentence_structure:
                parts.append(f"Speaking / writing rhythm: {profile.communication_style.sentence_structure[:220]}")
            if profile.communication_style.vocabulary:
                vw = ", ".join(profile.communication_style.vocabulary[:12])
                parts.append(f"Typical vocabulary flavor: {vw}.")
        traits = profile.traits or {}
        if traits:
            top = sorted(traits.items(), key=lambda x: -float(x[1]))[:8]
            parts.append(
                "Dominant traits (show in face, posture, styling): "
                + ", ".join(f"{k} ({float(v):.2f})" for k, v in top)
            )
        elif traits_desc.strip():
            parts.append(traits_desc.strip())
        parts.append(
            "SETTING PICK: Choose one coherent environment (indoor or outdoor) that a person with this bio would "
            "plausibly inhabit during a typical week — vary from office-only defaults."
        )
        return "\n".join(parts)

    def _render_template(
        self,
        template: str,
        profile: PersonaProfile,
        name: str,
        segment: str,
        traits_desc: str,
        profile_dict: dict | None = None,
    ) -> str:
        """
        Render template by replacing variables in both {{ }} and ${} formats.

        Supports variables:
        - name, profession, traits_desc, persona_profile, bio, headline
        """
        pd = profile_dict if isinstance(profile_dict, dict) else None

        logger.info(
            "persona_image.render_template_debug",
            has_profile_dict=pd is not None,
            profile_dict_keys=list(pd.keys()) if pd else None,
            interests=pd.get("interests") if pd else None,
            values=pd.get("values") if pd else None,
        )

        profile_lines: list[str] = []

        fn = getattr(profile, "full_name", None) or (pd.get("full_name") if pd else None)
        profile_lines.append(f"Display name: {profile.name}")
        if fn and str(fn).strip():
            profile_lines.append(f"Full name: {fn}")

        profile_lines.append(f"Profession / segment: {profile.segment}")
        if profile.headline:
            profile_lines.append(f"Headline: {profile.headline}")
        if profile.bio:
            profile_lines.append(f"Bio: {profile.bio}")

        if profile.traits:
            trait_bits = [f"{k} ({float(v):.2f})" for k, v in sorted(profile.traits.items(), key=lambda x: -x[1])[:12]]
            if trait_bits:
                profile_lines.append(f"Traits (scored): {', '.join(trait_bits)}")

        interests = (pd.get("interests") if pd else None) or getattr(profile, "interests", None) or []
        if isinstance(interests, list) and interests:
            profile_lines.append(f"Interests: {', '.join(str(x) for x in interests[:12])}")

        values = (pd.get("values") if pd else None) or getattr(profile, "values", None) or []
        if isinstance(values, list) and values:
            profile_lines.append(f"Values: {', '.join(str(x) for x in values[:10])}")

        if profile.goals:
            profile_lines.append("Goals: " + ", ".join(g.label for g in profile.goals[:6]))
        if profile.pain_points:
            profile_lines.append("Pain points: " + ", ".join(pp.label for pp in profile.pain_points[:6]))

        if profile.communication_style:
            if profile.communication_style.vocabulary:
                profile_lines.append(
                    "Vocabulary: " + ", ".join(profile.communication_style.vocabulary[:15])
                )
            if profile.communication_style.sentence_structure:
                profile_lines.append(f"Sentence style: {profile.communication_style.sentence_structure[:400]}")

        if pd:
            if pd.get("age") is not None:
                profile_lines.append(f"Age: {pd.get('age')}")
            if pd.get("location"):
                profile_lines.append(f"Location: {pd.get('location')}")
            if pd.get("gender"):
                profile_lines.append(f"Gender presentation: {pd.get('gender')}")
            if pd.get("media_affinity") is not None:
                profile_lines.append(f"Media affinity (0-100): {pd.get('media_affinity')}")
            if pd.get("attention_span"):
                profile_lines.append(f"Attention span note: {pd.get('attention_span')}")
            sm = pd.get("social_media_usage") or pd.get("socialMediaUsage")
            if isinstance(sm, list) and sm:
                profile_lines.append("Social / channels: " + ", ".join(str(x) for x in sm[:8]))
            cp = pd.get("color_palette") or pd.get("colorPalette")
            if isinstance(cp, list) and cp:
                profile_lines.append("Palette hints: " + ", ".join(str(x) for x in cp[:8]))

        base_profile_text = "\n".join(profile_lines)
        visual_brief_text = self._visual_story_for_image(profile, pd, traits_desc)
        persona_profile_text = base_profile_text + "\n\n--- VISUAL STORY (for the image model) ---\n" + visual_brief_text

        # Create variable mapping
        variables = {
            "name": name,
            "profession": segment,
            "traits_desc": traits_desc if traits_desc.strip() else "See scored traits in persona brief above.",
            "persona_profile": persona_profile_text,
            "visual_brief": visual_brief_text,
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

    def _build_portrait_prompt(self, profile: PersonaProfile, project_id: str | None = None, profile_dict: dict | None = None) -> str:
        """Build a detailed prompt for realistic portrait generation."""
        name = profile.name
        segment = profile.segment
        pd = profile_dict if isinstance(profile_dict, dict) else None

        traits_desc = ""
        if profile.traits:
            trait_list = []
            for trait_name, score in profile.traits.items():
                if float(score) > 0.55:
                    trait_list.append(f"{trait_name} ({float(score):.2f})")
            if trait_list:
                traits_desc = " Dominant traits: " + ", ".join(trait_list[:8]) + "."
        
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
                            rendered = self._render_template(
                                result.template, profile, name, segment, traits_desc, profile_dict=pd
                            )
                            
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
                    rendered = self._render_template(
                        template_record.template, profile, name, segment, traits_desc, profile_dict=pd
                    )
                    
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
        
        logger.info("persona_image.using_fallback_prompt")
        return self._render_template(
            DEFAULT_PERSONA_AVATAR_IMAGE_TEMPLATE,
            profile,
            name,
            segment,
            traits_desc,
            profile_dict=pd,
        )

    def generate_portrait(
        self, 
        profile: PersonaProfile, 
        project_id: str | None = None, 
        profile_dict: dict | None = None,
        save_to_storage: bool = True
    ) -> Optional[str]:
        """
        Generate a portrait image for a persona.
        
        Args:
            profile: The persona profile to generate an image for
            project_id: Optional project ID for template overrides
            profile_dict: Optional full profile dict with interests, values, etc.
            save_to_storage: Whether to download and save the image to storage
            
        Returns:
            URL to the generated image, or None if generation failed
        """
        if not self._client:
            logger.error("persona_image.api_key_missing")
            return None

        try:
            prompt = self._build_portrait_prompt(profile, project_id=project_id, profile_dict=profile_dict)
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
