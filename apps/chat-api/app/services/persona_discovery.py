from __future__ import annotations

import json
from dataclasses import dataclass
from typing import List

import structlog
from anthropic import Anthropic
from qdrant_client import QdrantClient

from ..core.config import get_settings

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
        self._anthropic = Anthropic(api_key=settings.anthropic_api_key)
        # Disable compatibility check to avoid warnings with Qdrant 1.11.3
        self._qdrant = QdrantClient(
            url=settings.qdrant_url,
            api_key=settings.qdrant_api_key,
            check_compatibility=False,
        )
        self._collection = "research_chunks"

    def discover(self, *, query_embedding: list[float]) -> List[PersonaCandidate]:
        """Discover personas from research data based on query embedding."""
        # Use query_points instead of search (new API in qdrant-client 1.16+)
        response = self._qdrant.query_points(
            collection_name=self._collection,
            query=query_embedding,  # Dense vector for nearest search
            limit=20,
            with_payload=True,
            with_vectors=False,
        )
        search = response.points if hasattr(response, 'points') else []

        excerpts = [
            f"[{hit.payload.get('chunk_id', '')}] {hit.payload.get('content', '')}"
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
                model="claude-3-5-haiku-20241022",
                max_tokens=800,
                temperature=0.1,
                messages=[
                    {
                        "role": "user",
                        "content": prompt,
                    }
                ],
            )
        except Exception as e:
            logger.error("persona.discovery.api_error", error=str(e), exc_info=True)
            return []

        if not response.content or len(response.content) == 0:
            logger.warning("persona.discovery.empty_response")
            return []
        
        # Extract text content from response
        text_content = response.content[0].text if hasattr(response.content[0], 'text') else str(response.content[0])
        logger.info("persona.discovery.response_received", length=len(text_content), preview=text_content[:200])
        
        # Remove markdown code blocks if present (```json ... ```)
        import re
        json_match = re.search(r'```(?:json)?\s*(\[.*?\])\s*```', text_content, re.DOTALL)
        if json_match:
            text_content = json_match.group(1)
        else:
            # Try to find JSON array directly
            json_match = re.search(r'\[.*\]', text_content, re.DOTALL)
            if json_match:
                text_content = json_match.group(0)
        
        try:
            parsed = json.loads(text_content)
        except Exception as exc:  # noqa: BLE001
            logger.warning("persona.discovery.parse_failed", error=str(exc), content_preview=text_content[:500])
            return []

        candidates = []
        for persona in parsed[:3]:
            candidates.append(
                PersonaCandidate(
                    name=persona.get("name", "Unknown"),
                    segment=persona.get("segment", "Unknown"),
                    confidence=float(persona.get("confidence", 0.5)),
                    chunk_ids=[str(chunk) for chunk in persona.get("chunk_ids", [])],
                )
            )
        return candidates

