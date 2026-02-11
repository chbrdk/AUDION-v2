from __future__ import annotations

from typing import List

from anthropic import Anthropic
from msqdx_glass_proto import ChatEvent, CompleteEvent, ContentDeltaEvent, SourcesEvent, ThinkingEvent

from ..core.config import get_settings

settings = get_settings()


class PersonaAgent:
    def __init__(self) -> None:
        self._anthropic = Anthropic(api_key=settings.claude_api_key)

    def stream_response(
        self,
        *,
        system_prompt: str,
        question: str,
        sources: List[dict],
        persona_id: str,
        send_event: callable,
    ) -> None:
        send_event(ThinkingEvent(status="Retrieving evidence…"))
        stream = self._anthropic.messages.stream(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            temperature=0.4,
            system=system_prompt,
            messages=[
                {
                    "role": "user",
                    "content": f"Answer with citations referencing chunk IDs. Question: {question}",
                }
            ],
        )

        aggregated = ""
        for event in stream:
            if event.type == "content_block_delta":
                delta = event.delta.get("text", "")
                aggregated += delta
                send_event(
                    ContentDeltaEvent(
                        persona_id=persona_id,
                        delta=delta,
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

