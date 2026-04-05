from __future__ import annotations

from dataclasses import dataclass
from typing import Any, List

import structlog
from anthropic import Anthropic
from qdrant_client import QdrantClient

from ..core.config import get_settings
from .anthropic_usage_raw import raw_units_from_anthropic_message

logger = structlog.get_logger(__name__)
settings = get_settings()


@dataclass
class PersonaCandidate:
    name: str
    segment: str
    confidence: float
    chunk_ids: List[str]


class PersonaDiscoveryService:
    def __init__(self) -> None:
        self._anthropic = Anthropic(api_key=settings.claude_api_key)
        self._qdrant = QdrantClient(settings.qdrant_url)
        self._collection = "research_chunks"

    def discover(
        self, *, query_embedding: list[float]
    ) -> tuple[List[PersonaCandidate], dict[str, Any], bool]:
        search = self._qdrant.search(
            collection_name=self._collection,
            query_vector=query_embedding,
            limit=20,
        )

        excerpts = [
            f"[{hit.payload.get('chunk_id')}] {hit.payload.get('content')}"
            for hit in search
            if hit.payload
        ]

        prompt = (
            "You analyze UX research excerpts and infer recurring personas. "
            "Return strict JSON as an array of {name, segment, confidence, chunk_ids[]}.\n\n"
            + "\n".join(excerpts)
        )

        logger.info("persona.discovery.prompt_tokens", length=len(prompt))
        try:
            response = self._anthropic.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=1024,
                temperature=0.1,
                messages=[
                    {
                        "role": "user",
                        "content": prompt,
                    }
                ],
            )
        except Exception as exc:  # noqa: BLE001
            logger.error("persona.discovery.api_error", error=str(exc), exc_info=True)
            return [], {}, False

        usage_raw = raw_units_from_anthropic_message(response)
        text_blocks = [b for b in response.content if getattr(b, "type", None) == "text"]
        content = text_blocks[0].text if text_blocks else ""
        try:
            import json

            parsed = json.loads(content)
        except Exception as exc:  # noqa: BLE001
            logger.warning("persona.discovery.parse_failed", error=str(exc))
            return [], usage_raw, True

        if not isinstance(parsed, list):
            return [], usage_raw, True

        candidates = []
        for persona in parsed[:3]:
            if not isinstance(persona, dict):
                continue
            candidates.append(
                PersonaCandidate(
                    name=persona.get("name", "Unknown"),
                    segment=persona.get("segment", "Unknown"),
                    confidence=float(persona.get("confidence", 0.5)),
                    chunk_ids=[str(chunk) for chunk in persona.get("chunk_ids", [])],
                )
            )
        return candidates, usage_raw, True

