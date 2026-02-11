from __future__ import annotations

import json
import re
import shutil
import time
from datetime import datetime
from pathlib import Path
from string import Template
from typing import Any, Dict, Iterable, List
from uuid import UUID, uuid4

import structlog
import yaml
from anthropic import Anthropic
from openai import OpenAI
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..models import AiTemplateOverride, Journey, JourneyPhase
from ..schemas import (
    AiAssistRequest,
    AiAssistResponse,
    AiAssistSuggestion,
    AiProvider,
    AiTemplateDefinition,
    AiTemplateSummary,
)
from ..services.persona_store import PersonaService
from ..services.target_group_store import TargetGroupService

logger = structlog.get_logger(__name__)


class PromptTemplateRegistry:
    """Loads and caches AI prompt templates from YAML."""

    def __init__(self, template_path: str | Path | None = None) -> None:
        settings = get_settings()
        from ..core.config import API_DIR
        default_path = API_DIR / "app" / "prompts" / "templates.yaml"
        self.template_path = Path(template_path or settings.ai_knowledge_templates_path or default_path)
        self._cache: dict[str, AiTemplateDefinition] = {}
        self._last_loaded_mtime: float = 0.0

    def list_templates(self) -> List[AiTemplateSummary]:
        self._maybe_reload()
        return [
            AiTemplateSummary(
                template_id=tpl.template_id,
                label=tpl.label,
                description=tpl.description,
                category=tpl.category,
                tags=tpl.tags,
                default_provider=tpl.default_provider,
                default_model=tpl.default_model,
            )
            for tpl in self._cache.values()
        ]

    def get(self, template_id: str) -> AiTemplateDefinition:
        self._maybe_reload()
        template = self._cache.get(template_id)
        if not template:
            raise KeyError(f"Template '{template_id}' is not registered")
        return template

    def get_full_template(self, template_id: str) -> AiTemplateDefinition:
        """Get full template definition including prompt and output config."""
        return self.get(template_id)

    def update_template(self, template_id: str, updates: Dict[str, Any]) -> AiTemplateDefinition:
        """Update a template and persist changes to YAML file."""
        self._maybe_reload()
        template = self.get(template_id)
        
        # Apply updates
        update_dict = template.model_dump()
        for key, value in updates.items():
            if value is not None:
                if key == "output" and isinstance(value, dict):
                    # Merge output config
                    current_output = update_dict.get("output", {})
                    current_output.update(value)
                    update_dict["output"] = current_output
                else:
                    update_dict[key] = value
        
        # Validate updated template
        updated_template = AiTemplateDefinition(**update_dict)
        
        # Update cache
        self._cache[template_id] = updated_template
        
        # Persist to YAML
        self._save_templates()
        
        logger.info("ai.templates.updated", template_id=template_id)
        return updated_template

    def _save_templates(self) -> None:
        """Write current cache to YAML file with backup."""
        if not self.template_path.exists():
            logger.error("ai.templates.save_failed", reason="template_path_not_found", path=str(self.template_path))
            raise RuntimeError(f"Template file not found: {self.template_path}")
        
        # Create backup
        backup_path = self.template_path.with_suffix(f".yaml.backup.{int(time.time())}")
        try:
            shutil.copy2(self.template_path, backup_path)
            logger.info("ai.templates.backup_created", backup=str(backup_path))
        except Exception as exc:
            logger.warning("ai.templates.backup_failed", error=str(exc))
        
        # Convert templates to YAML format
        templates_list = []
        for template in sorted(self._cache.values(), key=lambda t: t.template_id):
            # Use mode='json' to automatically convert Enums to their values
            template_dict = template.model_dump(mode='json')
            # Convert output config properly
            if "output" in template_dict and isinstance(template_dict["output"], dict):
                output = template_dict["output"]
                if not output.get("item_fields"):
                    output["item_fields"] = {}
            templates_list.append(template_dict)
        
        yaml_data = {"templates": templates_list}
        
        # Write YAML
        try:
            with self.template_path.open("w", encoding="utf-8") as handle:
                yaml.dump(yaml_data, handle, default_flow_style=False, allow_unicode=True, sort_keys=False, indent=2)
            self._last_loaded_mtime = self.template_path.stat().st_mtime
            logger.info("ai.templates.saved", count=len(templates_list), path=str(self.template_path))
        except Exception as exc:
            logger.error("ai.templates.save_failed", error=str(exc), exc_info=True)
            raise RuntimeError(f"Failed to save templates: {exc}") from exc

    def _maybe_reload(self) -> None:
        if not self.template_path.exists():
            logger.warning("ai.templates.missing", path=str(self.template_path))
            self._cache = {}
            self._last_loaded_mtime = time.time()
            return

        mtime = self.template_path.stat().st_mtime
        if mtime <= self._last_loaded_mtime:
            return

        try:
            with self.template_path.open("r", encoding="utf-8") as handle:
                payload = yaml.safe_load(handle) or {}
        except Exception as exc:  # pragma: no cover - defensive
            logger.error("ai.templates.load_failed", error=str(exc))
            return

        templates: dict[str, AiTemplateDefinition] = {}
        for entry in payload.get("templates", []):
            try:
                template = AiTemplateDefinition(**entry)
                templates[template.template_id] = template
            except Exception as exc:  # pragma: no cover - validation guard
                logger.error("ai.templates.invalid", template=entry.get("template_id"), error=str(exc))
        self._cache = templates
        self._last_loaded_mtime = mtime
        logger.info("ai.templates.loaded", count=len(self._cache), path=str(self.template_path))


def seed_default_templates_for_project(session: Session, project_id: str) -> int:
    """
    Create AiTemplateOverride rows for all base templates when a new project is created.
    Each project gets its own copy of the default templates so they are immediately available.
    Returns the number of templates seeded.
    """
    try:
        project_uuid = UUID(project_id)
    except ValueError:
        logger.warning("ai.templates.seed.invalid_project_id", project_id=project_id)
        return 0

    registry = PromptTemplateRegistry()
    base_templates = registry.list_templates()
    if not base_templates:
        logger.info("ai.templates.seed.no_templates", project_id=project_id)
        return 0

    count = 0
    for summary in base_templates:
        try:
            full = registry.get_full_template(summary.template_id)
            payload = full.model_dump(mode="json")
            # payload contains all override-able fields
            existing = session.scalar(
                select(AiTemplateOverride).where(
                    AiTemplateOverride.project_id == project_uuid,
                    AiTemplateOverride.template_id == summary.template_id,
                )
            )
            if existing:
                continue
            override = AiTemplateOverride(
                id=uuid4(),
                project_id=project_uuid,
                template_id=summary.template_id,
                payload=payload,
                updated_at=datetime.utcnow(),
                updated_by=None,
            )
            session.add(override)
            count += 1
        except Exception as exc:
            logger.warning(
                "ai.templates.seed.skip",
                template_id=summary.template_id,
                project_id=project_id,
                error=str(exc),
            )
    if count > 0:
        session.flush()
        logger.info("ai.templates.seeded", project_id=project_id, count=count)
    return count


def _apply_template_override(template: AiTemplateDefinition, override: Dict[str, Any]) -> AiTemplateDefinition:
    if not override:
        return template
    data = template.model_dump()
    for key, value in override.items():
        if value is None:
            continue
        if key == "output" and isinstance(value, dict):
            current_output = data.get("output", {}) or {}
            current_output.update(value)
            data["output"] = current_output
        else:
            data[key] = value
    return AiTemplateDefinition(**data)


class _ExtendedVariableResolver:
    """Resolves extended variable syntax like ${persona:${persona_id}.name} to actual values."""

    def __init__(self, session: Session | None = None) -> None:
        self.session = session
        self.persona_service = PersonaService()
        self.target_group_service = TargetGroupService()

    def resolve(self, var_name: str, context: Dict[str, Any]) -> str:
        """
        Resolve an extended variable like ${persona:${persona_id}.name}
        
        Args:
            var_name: The full variable including ${} wrapper, e.g., "${persona:${persona_id}.name}"
            context: The template context dictionary
            
        Returns:
            Resolved string value or placeholder on error
        """
        if not self.session:
            logger.warning("ai.assist.extended_var.no_session", var_name=var_name)
            return "[Session not available]"
        
        try:
            # Parse the extended variable syntax: ${resolver_type:${id_var}.path}
            match = re.match(r'\$\{([^:]+):\$\{([^}]+)\}([^}]*)\}', var_name)
            if not match:
                logger.warning("ai.assist.extended_var.invalid_syntax", var_name=var_name)
                return "[Invalid resolver syntax]"
            
            resolver_type = match.group(1).strip()
            id_variable = match.group(2).strip()
            property_path = match.group(3).strip()
            
            # Resolve the ID variable from context
            # Note: context values are stringified, so entity_id will be a string
            entity_id = context.get(id_variable, "")
            if not entity_id:
                logger.warning("ai.assist.extended_var.missing_id", var_name=var_name, id_var=id_variable)
                return f"[{resolver_type.capitalize()} ID not found]"
            
            # Convert to string
            entity_id_str = str(entity_id).strip()
            if not entity_id_str:
                return f"[{resolver_type.capitalize()} ID is empty]"
            
            # Resolve based on type
            if resolver_type == "knowledge":
                # Knowledge resolver doesn't require UUID validation - query can be any string
                return self._resolve_knowledge(entity_id_str, property_path, context)
            else:
                # Other resolvers require UUID validation
                try:
                    UUID(entity_id_str)
                except ValueError:
                    logger.warning("ai.assist.extended_var.invalid_uuid", var_name=var_name, entity_id=entity_id_str)
                    return f"[Invalid {resolver_type} ID]"
            
            # Resolve UUID-based entities
            if resolver_type == "persona":
                return self._resolve_persona(entity_id_str, property_path)
            elif resolver_type == "journey":
                return self._resolve_journey(entity_id_str, property_path)
            elif resolver_type == "target_group":
                return self._resolve_target_group(entity_id_str, property_path)
            elif resolver_type == "phase":
                return self._resolve_phase(entity_id_str, property_path)
            else:
                logger.warning("ai.assist.extended_var.unknown_resolver", resolver_type=resolver_type)
                return "[Invalid resolver]"
                
        except Exception as exc:
            logger.warning("ai.assist.extended_var.resolve_failed", var_name=var_name, error=str(exc), exc_info=True)
            return "[Resolution error]"

    def _resolve_persona(self, persona_id: str, path: str) -> str:
        """Resolve persona properties."""
        try:
            persona = self.persona_service.get_persona(self.session, persona_id, use_cache=True)
            return self._navigate_property_path(persona, path, "Persona")
        except ValueError:
            return "[Persona not found]"
        except Exception as exc:
            logger.warning("ai.assist.extended_var.persona_failed", persona_id=persona_id, error=str(exc))
            return "[Persona resolution error]"

    def _resolve_journey(self, journey_id: str, path: str) -> str:
        """Resolve journey properties."""
        try:
            journey_uuid = UUID(journey_id)
            journey = self.session.get(Journey, journey_uuid)
            if not journey:
                return "[Journey not found]"
            
            # Convert Journey model to dict-like structure for navigation
            journey_dict = {
                "id": str(journey.id),
                "name": journey.name,
                "description": journey.description,
                "journey_type": journey.journey_type,
                "phases": [
                    {
                        "id": str(ph.id),
                        "name": ph.name,
                        "description": ph.description,
                        "phase_order": ph.phase_order,
                        "expected_emotion": ph.expected_emotion,
                        "expected_duration_min": ph.expected_duration_min,
                        "expected_duration_max": ph.expected_duration_max,
                        "duration_unit": ph.duration_unit,
                    }
                    for ph in sorted(journey.phases, key=lambda p: p.phase_order or 0)
                ] if journey.phases else [],
            }
            return self._navigate_property_path(journey_dict, path, "Journey")
        except ValueError:
            return "[Invalid journey ID]"
        except Exception as exc:
            logger.warning("ai.assist.extended_var.journey_failed", journey_id=journey_id, error=str(exc))
            return "[Journey resolution error]"

    def _resolve_target_group(self, tg_id: str, path: str) -> str:
        """Resolve target group properties."""
        try:
            tg = self.target_group_service.get_target_group(self.session, tg_id)
            return self._navigate_property_path(tg, path, "Target Group")
        except ValueError:
            return "[Target Group not found]"
        except Exception as exc:
            logger.warning("ai.assist.extended_var.target_group_failed", tg_id=tg_id, error=str(exc))
            return "[Target Group resolution error]"

    def _resolve_phase(self, phase_id: str, path: str) -> str:
        """Resolve phase properties."""
        try:
            phase_uuid = UUID(phase_id)
            phase = self.session.get(JourneyPhase, phase_uuid)
            if not phase:
                return "[Phase not found]"
            
            phase_dict = {
                "id": str(phase.id),
                "name": phase.name,
                "description": phase.description,
                "phase_order": phase.phase_order,
                "expected_emotion": phase.expected_emotion,
                "emotion_intensity": phase.emotion_intensity,
                "expected_duration_min": phase.expected_duration_min,
                "expected_duration_max": phase.expected_duration_max,
                "duration_unit": phase.duration_unit,
            }
            return self._navigate_property_path(phase_dict, path, "Phase")
        except ValueError:
            return "[Invalid phase ID]"
        except Exception as exc:
            logger.warning("ai.assist.extended_var.phase_failed", phase_id=phase_id, error=str(exc))
            return "[Phase resolution error]"

    def _resolve_knowledge(self, query_or_id: str, path: str, context: Dict[str, Any]) -> str:
        """Resolve knowledge search results."""
        try:
            from ..agents.retrieval import RetrievalAgent
            
            retrieval_agent = RetrievalAgent()
            
            # Get persona_segment from context if available for filtering
            persona_segment = context.get("persona_segment")
            target_group_id = context.get("target_group_id")
            
            # Check if query_or_id is a UUID (target_group_id) or a search query
            is_uuid = False
            try:
                UUID(query_or_id)
                is_uuid = True
            except ValueError:
                pass
            
            if is_uuid and path.startswith(".content"):
                # If it's a UUID and path is .content, treat as target_group_id
                # Use KnowledgeExplorerService for target group chunks
                try:
                    from ..services.knowledge_explorer import KnowledgeExplorerService
                    explorer = KnowledgeExplorerService()
                    chunks_data = explorer.get_chunks_for_target_group(self.session, query_or_id, limit=50)
                    
                    # Format based on path
                    if path == ".content" or path == "":
                        return "\n\n".join([chunk.get("content", "")[:500] for chunk in chunks_data[:10]])
                    elif path == ".results":
                        # JSON format
                        results = [
                            {
                                "content": chunk.get("content", "")[:500],
                                "document_id": chunk.get("document_id", ""),
                                "relevance_score": chunk.get("relevance_score", 0.0),
                            }
                            for chunk in chunks_data[:10]
                        ]
                        return json.dumps(results, ensure_ascii=False, indent=2)
                except Exception as exc:
                    logger.warning("ai.assist.extended_var.knowledge_target_group_failed", error=str(exc))
                    # Fallback to search
                    pass
            
            # Perform semantic search using RetrievalAgent
            _, hits = retrieval_agent.run(
                query=query_or_id,
                target_group_id=target_group_id,
                persona_segment=persona_segment
            )
            
            # Format results based on path
            if path == ".content" or path == "":
                # Return content of top results (newline-separated)
                contents = []
                for hit in hits[:5]:
                    if hit.payload:
                        content = hit.payload.get("content", "")
                        if content:
                            contents.append(content[:500])
                return "\n\n".join(contents) if contents else "[No knowledge found]"
            elif path == ".results":
                # Return structured JSON results
                results = []
                for hit in hits[:5]:
                    if hit.payload:
                        score = 0.0
                        if hasattr(hit, "score"):
                            score = float(hit.score)
                        elif isinstance(hit, dict) and "score" in hit:
                            score = float(hit["score"])
                        
                        results.append({
                            "content": hit.payload.get("content", "")[:500],
                            "document_id": str(hit.payload.get("document_id", "")),
                            "chunk_id": str(hit.payload.get("chunk_id", "")),
                            "score": score,
                        })
                return json.dumps(results, ensure_ascii=False, indent=2) if results else "[]"
            else:
                return f"[Unknown knowledge path: {path}]"
        except Exception as exc:
            logger.warning("ai.assist.extended_var.knowledge_failed", query=query_or_id[:100], error=str(exc), exc_info=True)
            return "[Knowledge resolution error]"

    def _navigate_property_path(self, obj: Any, path: str, entity_type: str) -> str:
        """
        Navigate a property path like ".name" or ".phases[0].name" or ".phases[*].name"
        
        Args:
            obj: The object to navigate (dict, Pydantic model, or object)
            path: The property path (e.g., ".name", ".profile.traits", ".phases[0].name")
            entity_type: Entity type name for error messages
            
        Returns:
            String representation of the value or placeholder
        """
        if not path or path == ".":
            # Return stringified object if no path
            return self._stringify_value(obj)
        
        # Remove leading dot
        path = path.lstrip(".")
        if not path:
            return self._stringify_value(obj)
        
        current = obj
        parts = path.split(".")
        
        for i, part in enumerate(parts):
            if not part:
                continue
            
            # Handle array indexing: phases[0] or phases[*]
            array_match = re.match(r'^([^\[]+)\[(\d+|\*)\]$', part)
            if array_match:
                attr_name = array_match.group(1)
                index_str = array_match.group(2)
                
                # Get the array
                current = self._get_attr(current, attr_name)
                if current is None:
                    return f"[{entity_type} property '{attr_name}' not found]"
                
                if not isinstance(current, (list, tuple)):
                    return f"[{entity_type} property '{attr_name}' is not an array]"
                
                if index_str == "*":
                    # Wildcard: return all items as joined string
                    if not current:
                        return ""
                    return "\n".join(self._stringify_value(item) for item in current)
                else:
                    # Specific index
                    try:
                        index = int(index_str)
                        if index < 0 or index >= len(current):
                            return f"[{entity_type} array index {index} out of range]"
                        current = current[index]
                    except (ValueError, IndexError):
                        return f"[{entity_type} invalid array index]"
            else:
                # Regular property access
                # Check if property exists before accessing
                attr_value = self._get_attr(current, part)
                if attr_value is None:
                    # Check if it's a missing property vs None value
                    # Try to determine if property exists
                    prop_exists = False
                    if isinstance(current, dict):
                        prop_exists = part in current
                    elif hasattr(current, part):
                        prop_exists = True
                    elif hasattr(current, "model_dump"):
                        try:
                            data = current.model_dump()
                            prop_exists = part in data
                        except Exception:
                            pass
                    
                    if not prop_exists:
                        return f"[{entity_type} property '{part}' not found]"
                    # Property exists but is None
                    return ""
                current = attr_value
        
        return self._stringify_value(current)

    def _get_attr(self, obj: Any, attr_name: str) -> Any:
        """Get attribute from object, dict, Pydantic model, or protobuf message."""
        if obj is None:
            return None
        
        # Handle dict
        if isinstance(obj, dict):
            return obj.get(attr_name)
        
        # Handle Pydantic models
        if hasattr(obj, "model_dump"):
            try:
                data = obj.model_dump()
                return data.get(attr_name)
            except Exception:
                # Fallback to direct attribute access
                pass
        
        # Handle protobuf messages (they have ListFields method)
        if hasattr(obj, "ListFields"):
            try:
                # Convert protobuf to dict
                pb_dict = {}
                for field, value in obj.ListFields():
                    pb_dict[field.name] = value
                return pb_dict.get(attr_name)
            except Exception:
                # Fallback to direct attribute access
                pass
        
        # Handle regular objects (including protobuf messages as fallback)
        if hasattr(obj, attr_name):
            return getattr(obj, attr_name)
        
        return None

    def _stringify_value(self, value: Any) -> str:
        """Convert a value to string representation."""
        if value is None:
            return ""
        if isinstance(value, (str, int, float, bool)):
            return str(value)
        if isinstance(value, (list, tuple)):
            return "\n".join(self._stringify_value(item) for item in value)
        if isinstance(value, dict):
            return json.dumps(value, ensure_ascii=False, indent=2)
        return str(value)


class AiAssistService:
    """Central service that executes templates via Anthropic / OpenAI."""

    def __init__(
        self,
        *,
        registry: PromptTemplateRegistry | None = None,
        session: Session | None = None,
        project_id: str | None = None,
    ) -> None:
        self.settings = get_settings()
        self.registry = registry or PromptTemplateRegistry()
        self.session = session
        self.project_id = project_id
        self._anthropic: Anthropic | None = None
        self._openai: OpenAI | None = None

    def _load_override(self, *, session: Session, project_id: str, template_id: str) -> dict | None:
        try:
            project_uuid = UUID(project_id)
        except ValueError:
            raise ValueError("invalid_project_id")
        override = session.scalar(
            select(AiTemplateOverride).where(
                AiTemplateOverride.project_id == project_uuid,
                AiTemplateOverride.template_id == template_id,
            )
        )
        return override.payload if override else None

    def _load_overrides(self, *, session: Session, project_id: str) -> dict[str, dict]:
        try:
            project_uuid = UUID(project_id)
        except ValueError:
            raise ValueError("invalid_project_id")
        rows = session.scalars(
            select(AiTemplateOverride).where(AiTemplateOverride.project_id == project_uuid)
        ).all()
        return {row.template_id: row.payload for row in rows}

    def list_templates_for_project(self, *, session: Session, project_id: str) -> List[AiTemplateSummary]:
        base_templates = self.registry.list_templates()
        overrides = self._load_overrides(session=session, project_id=project_id)

        items: List[AiTemplateSummary] = []
        for template in base_templates:
            override = overrides.get(template.template_id)
            if override:
                # Apply overrides on summary-level fields
                data = template.model_dump()
                for key, value in override.items():
                    if key in data and value is not None:
                        data[key] = value
                template = AiTemplateSummary(**data)
            items.append(template)
        return items

    def get_template_for_project(
        self, *, session: Session, project_id: str, template_id: str
    ) -> AiTemplateDefinition:
        base = self.registry.get_full_template(template_id)
        override = self._load_override(session=session, project_id=project_id, template_id=template_id)
        return _apply_template_override(base, override or {})

    def update_template_override(
        self,
        *,
        session: Session,
        project_id: str,
        template_id: str,
        updates: Dict[str, Any],
        updated_by: str | None = None,
    ) -> AiTemplateDefinition:
        try:
            project_uuid = UUID(project_id)
        except ValueError as exc:
            raise ValueError("invalid_project_id") from exc

        # Ensure template exists
        _ = self.registry.get_full_template(template_id)

        existing = session.scalar(
            select(AiTemplateOverride).where(
                AiTemplateOverride.project_id == project_uuid,
                AiTemplateOverride.template_id == template_id,
            )
        )
        if existing:
            payload = dict(existing.payload or {})
            payload.update(updates)
            existing.payload = payload
            existing.updated_at = datetime.utcnow()
            existing.updated_by = updated_by
            session.commit()
            return self.get_template_for_project(
                session=session, project_id=project_id, template_id=template_id
            )

        new_override = AiTemplateOverride(
            id=uuid4(),
            project_id=project_uuid,
            template_id=template_id,
            payload=updates,
            updated_at=datetime.utcnow(),
            updated_by=updated_by,
        )
        session.add(new_override)
        session.commit()
        return self.get_template_for_project(session=session, project_id=project_id, template_id=template_id)

    async def generate(self, request: AiAssistRequest) -> AiAssistResponse:
        template = self.registry.get(request.template_id)
        if self.project_id and self.session:
            try:
                override = self._load_override(
                    session=self.session, project_id=self.project_id, template_id=request.template_id
                )
                if override:
                    template = _apply_template_override(template, override)
            except ValueError:
                # If project_id is invalid, ignore overrides and use base template
                pass
        provider = request.provider or template.default_provider or AiProvider(self.settings.ai_default_provider)
        model = request.model or template.default_model or self._default_model(provider)
        temperature = template.temperature or self.settings.ai_default_temperature
        max_tokens = template.max_tokens or self.settings.ai_default_max_tokens

        prompt_context = self._build_context(request.context, request.prompt_variables)
        rendered_prompt = self._render_prompt(template.prompt, prompt_context)

        logger.info(
            "ai.assist.dispatch",
            template_id=request.template_id,
            provider=provider.value,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        
        # Log the full rendered prompt for debugging
        logger.info(
            "ai.assist.prompt_full",
            template_id=request.template_id,
            prompt=rendered_prompt,
            context=prompt_context,
        )
        
        # Union logging removed - Audion is now autonomous

        raw_output, usage = await self._execute_prompt(
            provider=provider,
            model=model,
            prompt=rendered_prompt,
            temperature=temperature,
            max_tokens=max_tokens,
        )

        logger.info(
            "ai.assist.raw_output_received",
            template_id=template.template_id,
            raw_output_length=len(raw_output) if raw_output else 0,
            raw_output_preview=raw_output[:500] if raw_output else "",
        )

        suggestions = self._parse_output(template, raw_output, request.max_suggestions)
        
        logger.info(
            "ai.assist.parsing_complete",
            template_id=template.template_id,
            suggestions_count=len(suggestions),
            raw_output_length=len(raw_output) if raw_output else 0,
        )
        return AiAssistResponse(
            template_id=request.template_id,
            provider=provider,
            model=model,
            suggestions=suggestions,
            raw_output=raw_output,
            usage=usage,
        )

    def _default_model(self, provider: AiProvider) -> str:
        if provider == AiProvider.ANTHROPIC:
            return self.settings.ai_anthropic_model
        return self.settings.ai_openai_model

    def _build_context(self, context: Dict[str, Any], prompt_vars: Dict[str, Any]) -> Dict[str, Any]:
        merged = {**context, **prompt_vars}
        flattened: Dict[str, Any] = {}
        for key, value in merged.items():
            flattened[key] = self._stringify(value)
        return flattened

    def _stringify(self, value: Any) -> str:
        if value is None:
            return ""
        if isinstance(value, (str, int, float)):
            return str(value)
        if isinstance(value, (list, tuple, set)):
            return "\n".join(self._stringify(item) for item in value)
        if isinstance(value, dict):
            return json.dumps(value, ensure_ascii=False, indent=2)
        return str(value)

    def _render_prompt(self, prompt: str, context: Dict[str, Any]) -> str:
        # Step 1: Find and resolve extended variables (e.g., ${persona:${persona_id}.name})
        # Pattern matches: ${resolver_type:${id_var}.property.path}
        # We need to handle nested ${} properly, so we match from the outer ${ to the matching }
        if self.session:
            resolver = _ExtendedVariableResolver(self.session)
            processed_prompt = prompt
            replacements = {}
            
            # Find all extended variable patterns by looking for ${type:${...}...}
            # We'll use a more sophisticated approach: find ${, then look for :${, then find the matching }
            pattern = r'\$\{([a-z_]+):\$\{([^}]+)\}([^}]*)\}'
            matches = list(re.finditer(pattern, prompt))
            
            for match in matches:
                full_var = match.group(0)  # e.g., "${persona:${persona_id}.name}"
                resolved_value = resolver.resolve(full_var, context)
                # Create a unique placeholder key
                placeholder_key = f"_ext_var_{abs(hash(full_var)) % 1000000}"
                replacements[full_var] = placeholder_key
                context[placeholder_key] = resolved_value
            
            # Replace extended variables with placeholders (in reverse order to avoid index issues)
            for original, placeholder in sorted(replacements.items(), key=lambda x: len(x[0]), reverse=True):
                processed_prompt = processed_prompt.replace(original, f"${{{placeholder}}}")
            
            # Step 2: Standard template substitution
            template = Template(processed_prompt)
            return template.safe_substitute(context)
        else:
            # No session, use standard substitution
            template = Template(prompt)
            return template.safe_substitute(context)

    async def _execute_prompt(
        self,
        *,
        provider: AiProvider,
        model: str,
        prompt: str,
        temperature: float,
        max_tokens: int,
    ) -> tuple[str, Dict[str, Any]]:
        if provider == AiProvider.ANTHROPIC:
            # Get API key from settings/environment variables only
            api_key = self.settings.claude_api_key
            if not api_key:
                raise RuntimeError("Anthropic API key not configured. Set CLAUDE_API_KEY environment variable.")
            
            if not self._anthropic and api_key:
                self._anthropic = Anthropic(api_key=api_key)
            if not self._anthropic:
                raise RuntimeError("Anthropic API key not configured")
            message = self._anthropic.messages.create(
                model=model,
                max_tokens=max_tokens,
                temperature=temperature,
                messages=[{"role": "user", "content": prompt}],
            )
            text_chunks = [
                part.text for part in message.content if hasattr(part, "text") and isinstance(part.text, str)
            ]
            usage = {
                "input_tokens": getattr(message.usage, "input_tokens", None),
                "output_tokens": getattr(message.usage, "output_tokens", None),
            }
            return "\n".join(text_chunks).strip(), usage

        # Get API key from settings/environment variables only
        api_key = self.settings.openai_api_key
        if not api_key:
            raise RuntimeError("OpenAI API key not configured. Set OPENAI_API_KEY environment variable.")
        
        if not self._openai and api_key:
            # Use http_client to avoid proxies parameter issues
            import httpx
            http_client = httpx.Client(
                timeout=httpx.Timeout(60.0, connect=10.0),
            )
            self._openai = OpenAI(
                api_key=api_key,
                http_client=http_client,
            )
        if not self._openai:
            raise RuntimeError("OpenAI API key not configured")
        # GPT-5 Mini only supports default temperature (1), so we don't pass temperature parameter
        response = self._openai.chat.completions.create(
            model=model,
            max_completion_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
        
        # Extract response content (content can be str or list of content parts)
        raw_text = ""
        finish_reason = None
        if response.choices:
            choice = response.choices[0]
            finish_reason = getattr(choice, "finish_reason", None)
            content = getattr(choice.message, "content", None)
            if isinstance(content, str):
                raw_text = content
            elif isinstance(content, list):
                parts = []
                for part in content:
                    if hasattr(part, "text") and part.text:
                        parts.append(part.text)
                    elif isinstance(part, dict) and part.get("type") == "text":
                        parts.append(part.get("text", "") or "")
                raw_text = "\n".join(parts) if parts else ""
        
        # Debug logging
        logger.info(
            "ai.assist.openai_response",
            choices_count=len(response.choices) if response.choices else 0,
            has_content=bool(raw_text),
            content_length=len(raw_text) if raw_text else 0,
            finish_reason=finish_reason,
            content_preview=raw_text[:200] if raw_text else "",
        )
        
        if not raw_text:
            logger.warning(
                "ai.assist.openai_empty_response",
                choices_count=len(response.choices) if response.choices else 0,
                finish_reason=finish_reason,
                usage_output_tokens=getattr(response.usage, "completion_tokens", None) if hasattr(response, "usage") else None,
            )
        
        usage = {
            "input_tokens": getattr(response.usage, "prompt_tokens", None),
            "output_tokens": getattr(response.usage, "completion_tokens", None),
        }
        return raw_text.strip() if raw_text else "", usage

    def _parse_output(
        self,
        template: AiTemplateDefinition,
        raw_output: str,
        max_suggestions: int | None,
    ) -> List[AiAssistSuggestion]:
        limit = max_suggestions or 0
        if template.output.mode == "json":
            json_blob = self._extract_json(raw_output)
            if not json_blob:
                return []
            try:
                data = json.loads(json_blob)
            except json.JSONDecodeError:
                logger.warning("ai.assist.json_decode_failed", template_id=template.template_id)
                return []

            payload = data
            if template.output.key:
                payload = data.get(template.output.key, [])
            if not isinstance(payload, Iterable):
                return []

            item_fields = template.output.item_fields or {}
            suggestions: List[AiAssistSuggestion] = []
            for idx, item in enumerate(payload):
                if not isinstance(item, dict):
                    continue
                content = item.get(item_fields.get("content", "content"))
                if not content:
                    continue
                suggestion = AiAssistSuggestion(
                    content=str(content).strip(),
                    title=item.get(item_fields.get("title", "title")),
                    type=item.get(item_fields.get("type", "type")),
                    metadata={k: v for k, v in item.items() if k not in ("content", "title", "type")},
                )
                suggestions.append(suggestion)
                if limit and len(suggestions) >= limit:
                    break
            return suggestions

        content = raw_output.strip()
        if not content:
            return []
        return [
            AiAssistSuggestion(
                content=content,
                metadata={"mode": "text"},
            )
        ]

    def _extract_json(self, text: str) -> str | None:
        start = text.find("{")
        end = text.rfind("}") + 1
        if start == -1 or end <= start:
            return None
        return text[start:end]

    async def test_prompt(
        self,
        prompt: str,
        context: Dict[str, Any],
        provider: AiProvider | None = None,
        model: str | None = None,
        temperature: float = 0.6,
        max_tokens: int = 1024,
    ) -> AiAssistResponse:
        """Test a custom prompt directly without requiring a template."""
        provider = provider or AiProvider(self.settings.ai_default_provider)
        model = model or self._default_model(provider)

        # Render the prompt with context (including extended variables)
        prompt_context = self._build_context(context, {})
        rendered_prompt = self._render_prompt(prompt, prompt_context)

        logger.info(
            "ai.assist.test_prompt",
            provider=provider.value,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
        )

        raw_output, usage = await self._execute_prompt(
            provider=provider,
            model=model,
            prompt=rendered_prompt,
            temperature=temperature,
            max_tokens=max_tokens,
        )

        # For test prompts, return the raw output as a single suggestion
        suggestions = [
            AiAssistSuggestion(
                content=raw_output,
                metadata={"mode": "test", "raw": True},
            )
        ]

        return AiAssistResponse(
            template_id="test",
            provider=provider,
            model=model,
            suggestions=suggestions,
            raw_output=raw_output,
            usage=usage,
        )
