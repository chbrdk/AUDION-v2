from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Tuple
from uuid import UUID

import json
import structlog

from ..agents.retrieval import RetrievalAgent
from ..core.config import get_settings
from ..db import get_session
from ..models import Journey, JourneyPhase, JourneyPhaseElement, JourneyElementType, Project
from ..schemas import AiAssistRequest
from ..services.ai_assist import AiAssistService, PromptTemplateRegistry
from ..services.usage_report import report_retrieval_query_usage
from ..services.persona_store import PersonaService
from ..services.target_group_store import TargetGroupService

logger = structlog.get_logger(__name__)
settings = get_settings()


def _safe_element_type(value: Any) -> JourneyElementType:
    """Map AI output string to JourneyElementType; default to action if invalid."""
    if isinstance(value, JourneyElementType):
        return value
    s = (value or "action").strip().lower().replace("-", "_")
    for member in JourneyElementType:
        if member.value == s:
            return member
    return JourneyElementType.action


@dataclass
class JourneyDraft:
    name: str
    description: str
    journey_type: str
    phases: List[Dict[str, Any]]


class JourneyGenerationService:
    def __init__(self) -> None:
        self.retrieval_agent = RetrievalAgent()
        self.persona_service = PersonaService()
        self.target_group_service = TargetGroupService()
        self.ai_assist = AiAssistService(registry=PromptTemplateRegistry())

    async def generate_journey_from_knowledge(
        self,
        target_group_id: UUID,
        journey_type: str,
        organization_id: UUID,
        *,
        retrieval_usage_user_id: str | None = None,
    ) -> Tuple[JourneyDraft, Dict[str, Any]]:
        """
        Generate a journey from Target Group knowledge and personas.
        Returns draft and AiAssist usage dict (for PLEXON), same shape as generate_journey_from_project.

        Uses:
        - TargetGroupService to get target group with knowledge entries
        - PersonaService to get personas of the target group
        - RetrievalAgent to find relevant chunks
        - Claude API for LLM-based generation
        """
        with get_session() as session:
            # 1. Get Target Group with knowledge and personas
            target_group_response = self.target_group_service.get_target_group(
                session, str(target_group_id)
            )
            
            # 2. Get full persona profiles for journey generation
            persona_profiles = []
            for persona_item in target_group_response.personas:
                persona_response = self.persona_service.get_persona(session, persona_item.id)
                persona_profiles.append({
                    "id": persona_item.id,
                    "name": persona_item.name,
                    "profile": persona_response.profile,
                })
            
            # 3. Use Retrieval Agent for relevant chunks
            # Get chunks from target group sources
            # chunk_ids = [source.get("chunk_id") for source in target_group_response.sources]
            
            # Search for journey-related content
            _, hits = self.retrieval_agent.run(
                query=f"Customer journey for {journey_type}",
                target_group_id=str(target_group_id),
            )
            if retrieval_usage_user_id and retrieval_usage_user_id != "system":
                report_retrieval_query_usage(retrieval_usage_user_id, queries=1)
            
            # 4. Build context for LLM
            knowledge_context = []
            for hit in hits[:20]:  # Limit to top 20 chunks
                if hit.payload:
                    knowledge_context.append({
                        "content": hit.payload.get("content", ""),
                        "score": hit.score,
                    })
            
            # 5. Generate journey with Claude
            journey_draft, usage_out = await self._generate_with_claude(
                target_group=target_group_response,
                personas=persona_profiles,
                knowledge_chunks=knowledge_context,
                journey_type=journey_type,
                retrieval_usage_user_id=retrieval_usage_user_id,
            )

            return journey_draft, usage_out

    async def generate_journey_from_project(
        self,
        session: Any,
        project_id: UUID,
        target_group_id: UUID | None,
        journey_type: str,
        organization_id: UUID,
        *,
        retrieval_usage_user_id: str | None = None,
    ) -> Tuple[JourneyDraft, Dict[str, Any]]:
        """
        Generate a full journey from project knowledge: project description + company_context,
        and optionally target group + personas + TG knowledge chunks.
        """
        project = session.get(Project, project_id)
        if not project:
            raise ValueError("project_not_found")
        parts = []
        if project.description and project.description.strip():
            parts.append(project.description.strip())
        if project.company_context and project.company_context.strip():
            parts.append(project.company_context.strip())
        company_context = "\n\n".join(parts) if parts else "No project or target group context provided."

        if target_group_id is None:
            target_group_name = "General (no target group selected)"
            target_group_summary = project.name or "Project"
            persona_summaries = "None"
            knowledge_context = company_context
            return await self._generate_with_context(
                target_group_name=target_group_name,
                target_group_summary=target_group_summary,
                journey_type=journey_type,
                persona_summaries=persona_summaries,
                knowledge_context=knowledge_context,
                company_context=company_context,
                retrieval_usage_user_id=retrieval_usage_user_id,
            )

        target_group_response = self.target_group_service.get_target_group(session, str(target_group_id))
        persona_profiles = []
        for persona_item in target_group_response.personas:
            persona_response = self.persona_service.get_persona(session, persona_item.id)
            persona_profiles.append({
                "id": persona_item.id,
                "name": persona_item.name,
                "profile": persona_response.profile,
            })
        persona_summaries_list = []
        for persona in persona_profiles:
            profile = persona["profile"]
            traits = ", ".join([f"{k}: {v}" for k, v in profile.traits.items()]) if hasattr(profile, "traits") and profile.traits else "N/A"
            goals = ", ".join([g.label if hasattr(g, "label") else str(g) for g in profile.goals]) if hasattr(profile, "goals") and profile.goals else "N/A"
            persona_summaries_list.append(f"- {persona['name']}: Traits: {traits}, Goals: {goals}")
        persona_summaries = "\n".join(persona_summaries_list) if persona_summaries_list else "No personas in this target group."

        knowledge_chunk_texts: List[str] = []
        try:
            from ..services.knowledge_explorer import KnowledgeExplorerService
            explorer = KnowledgeExplorerService()
            chunks_data = explorer.get_chunks_for_target_group(session, str(target_group_id), limit=50)
            for chunk in chunks_data[:30]:
                content = chunk.get("content") if isinstance(chunk, dict) else getattr(chunk, "content", None)
                if content:
                    knowledge_chunk_texts.append((content[:500] if isinstance(content, str) else str(content)[:500]))
        except Exception as exc:
            logger.warning("journey.generate.chunks_failed", error=str(exc))
        knowledge_context = "\n".join(knowledge_chunk_texts) if knowledge_chunk_texts else ""
        if company_context and knowledge_context:
            knowledge_context = company_context + "\n\n--- Knowledge chunks ---\n\n" + knowledge_context
        elif not knowledge_context:
            knowledge_context = company_context

        tg_summary = f"{target_group_response.name} • {getattr(target_group_response, 'segment', '') or 'n/a'}"
        if getattr(target_group_response, "description", None):
            tg_summary += f"\n{target_group_response.description}"

        return await self._generate_with_context(
            target_group_name=target_group_response.name,
            target_group_summary=tg_summary,
            journey_type=journey_type,
            persona_summaries=persona_summaries,
            knowledge_context=knowledge_context,
            company_context=company_context,
            retrieval_usage_user_id=retrieval_usage_user_id,
        )

    async def _generate_with_context(
        self,
        *,
        target_group_name: str,
        target_group_summary: str,
        journey_type: str,
        persona_summaries: str,
        knowledge_context: str,
        company_context: str = "",
        retrieval_usage_user_id: str | None = None,
    ) -> Tuple[JourneyDraft, Dict[str, Any]]:
        """Generate journey using template with pre-built context."""
        context = {
            "target_group_name": target_group_name,
            "target_group_summary": target_group_summary,
            "journey_type": journey_type,
            "persona_summaries": persona_summaries,
            "knowledge_context": knowledge_context,
            "company_context": company_context or "",
        }
        try:
            ai_request = AiAssistRequest(
                template_id="journey.full_generation",
                context=context,
            )
            response = await self.ai_assist.generate(
                ai_request,
                retrieval_usage_user_id=retrieval_usage_user_id,
            )
            usage_out: Dict[str, Any] = dict(response.usage or {})
            json_str = response.raw_output
            json_start = json_str.find("{")
            json_end = json_str.rfind("}") + 1
            if json_start >= 0 and json_end > json_start:
                journey_data = json.loads(json_str[json_start:json_end])
                return (
                    JourneyDraft(
                        name=journey_data.get("name", f"{journey_type} Journey"),
                        description=journey_data.get("description", ""),
                        journey_type=journey_type,
                        phases=journey_data.get("phases", []),
                    ),
                    usage_out,
                )
            logger.warning("journey.generate.invalid_json", content=json_str[:200])
            return (
                JourneyDraft(
                    name=f"{journey_type} Journey",
                    description=f"Generated journey for {journey_type}",
                    journey_type=journey_type,
                    phases=[],
                ),
                usage_out,
            )
        except Exception as exc:
            logger.error("journey.generate.failed", error=str(exc), exc_info=True)
            raise

    async def _generate_with_claude(
        self,
        target_group: Any,
        personas: List[Dict[str, Any]],
        knowledge_chunks: List[Dict[str, Any]],
        journey_type: str,
        company_context: str = "",
        *,
        retrieval_usage_user_id: str | None = None,
    ) -> Tuple[JourneyDraft, Dict[str, Any]]:
        """Generate journey using centralized AI assist service with templates."""
        persona_summaries = []
        for persona in personas:
            profile = persona["profile"]
            traits = ", ".join([f"{k}: {v}" for k, v in profile.traits.items()]) if hasattr(profile, 'traits') and profile.traits else "N/A"
            goals = ", ".join([g.label if hasattr(g, 'label') else str(g) for g in profile.goals]) if hasattr(profile, 'goals') and profile.goals else "N/A"
            persona_summaries.append(
                f"- {persona['name']}: Traits: {traits}, Goals: {goals}"
            )
        knowledge_text = "\n".join([chunk["content"][:500] for chunk in knowledge_chunks[:10]])
        tg_summary = f"{target_group.name} • {getattr(target_group, 'segment', '') or 'n/a'}"
        if getattr(target_group, "description", None):
            tg_summary += f"\n{target_group.description}"
        return await self._generate_with_context(
            target_group_name=target_group.name,
            target_group_summary=tg_summary,
            journey_type=journey_type,
            persona_summaries="\n".join(persona_summaries),
            knowledge_context=knowledge_text,
            company_context=company_context,
            retrieval_usage_user_id=retrieval_usage_user_id,
        )

    def save_journey_draft(
        self,
        draft: JourneyDraft,
        target_group_id: UUID | None,
        organization_id: UUID,
        project_id: UUID | None,
        created_by: str | None = None,
    ) -> Journey:
        """Save a journey draft to the database. target_group_id may be None for project-only generation."""
        with get_session() as session:
            try:
                journey = Journey(
                    organization_id=organization_id,
                    project_id=project_id,
                    target_group_id=target_group_id,
                    name=draft.name,
                    description=draft.description,
                    journey_type=draft.journey_type,
                    creation_mode="ai_generated",
                    created_by=created_by,
                )
                session.add(journey)
                session.flush()

                for phase_data in draft.phases:
                    phase = JourneyPhase(
                        journey_id=journey.id,
                        name=phase_data.get("name", ""),
                        description=phase_data.get("description"),
                        phase_order=phase_data.get("phase_order", 0),
                        expected_duration_min=phase_data.get("expected_duration_min"),
                        expected_duration_max=phase_data.get("expected_duration_max"),
                        duration_unit=phase_data.get("duration_unit", "minutes"),
                        expected_emotion=phase_data.get("expected_emotion"),
                        emotion_intensity=phase_data.get("emotion_intensity"),
                        generated_by_ai=True,
                        generation_confidence=0.8,
                    )
                    session.add(phase)
                    session.flush()

                    for element_data in phase_data.get("elements", []):
                        raw_type = element_data.get("element_type", "action")
                        element = JourneyPhaseElement(
                            phase_id=phase.id,
                            element_type=_safe_element_type(raw_type),
                            content=element_data.get("content", ""),
                            element_order=element_data.get("element_order", 0),
                        )
                        session.add(element)

                session.commit()
                session.refresh(journey)
                return journey
            except Exception as exc:
                session.rollback()
                logger.error("journey.save.failed", error=str(exc), exc_info=True)
                raise

