from __future__ import annotations

from typing import Callable, List

from anthropic import Anthropic
from udg_glass_proto import CompleteEvent, ContentDeltaEvent, SourcesEvent, ThinkingEvent

from ..core.config import get_settings
from ..utils.text import clean_response_text

settings = get_settings()


class PersonaAgent:
    def __init__(self) -> None:
        self._anthropic = Anthropic(api_key=settings.anthropic_api_key)

    def stream_response(
        self,
        *,
        system_prompt: str,
        question: str,
        sources: List[dict],
        persona_id: str,
        send_event: Callable,
    ) -> None:
        """Stream a persona response using Claude."""
        import structlog
        logger = structlog.get_logger(__name__)
        
        logger.info("persona.agent.streaming_start", persona_id=persona_id, question_length=len(question), sources_count=len(sources))
        send_event(ThinkingEvent(status="Retrieving evidence…"))
        
        try:
            stream = self._anthropic.messages.stream(
                model="claude-3-5-haiku-20241022",
                max_tokens=600,
                temperature=0.4,
                system=system_prompt,
                messages=[
                    {
                        "role": "user",
                        "content": (
                            "Answer succinctly in natural, conversational language. "
                            "Avoid repeating words or phrases, do not include document IDs, chunk IDs, brackets, or the word 'doc'. "
                            "Keep the reply under 90 words and at most three short paragraphs unless the user explicitly asks for more detail. "
                            "Do not mention confidence scores, percentages, or meta commentary. "
                            "Avoid markdown formatting (no bold, bullets) unless the user requests it. "
                            "Share only the most relevant details, and go deeper only when it truly adds value. "
                            f"User message: {question}"
                        ),
                    }
                ],
            )
        except Exception as e:
            logger.error("persona.agent.stream_failed", error=str(e), exc_info=True)
            send_event(ThinkingEvent(status=f"Error generating response: {str(e)}"))
            return

        aggregated = ""
        for event in stream:
            if event.type == "content_block_delta":
                delta_text = getattr(event.delta, "text", None)
                if delta_text is None and isinstance(event.delta, dict):
                    delta_text = event.delta.get("text", "")
                if not delta_text:
                    continue
                aggregated += delta_text
                send_event(
                    ContentDeltaEvent(
                        persona_id=persona_id,
                        delta=delta_text,
                    )
                )
        send_event(
            SourcesEvent(
                persona_id=persona_id,
                sources=[
                    {
                        "chunk_id": source["chunk_id"],
                        "document_id": source["document_id"],
                        "title": source.get("title", "Research"),
                        "confidence": source.get("confidence", 0.8),
                        "excerpt": source.get("content", "")[:320],
                    }
                    for source in sources[:5]
                ],
            )
        )
        send_event(CompleteEvent(persona_id=persona_id, latency_ms=0))

