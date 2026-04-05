from __future__ import annotations

import json
import re
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
        self._anthropic = Anthropic(api_key=settings.anthropic_api_key)
        # Disable compatibility check to avoid warnings with Qdrant 1.11.3
        self._qdrant = QdrantClient(
            url=settings.qdrant_url,
            api_key=settings.qdrant_api_key,
            check_compatibility=False,
        )
        self._collection = "research_chunks"

    def discover(
        self, *, query_embedding: list[float]
    ) -> tuple[list[PersonaCandidate], dict[str, Any], bool]:
        """Discover personas; returns (candidates, anthropic_usage_for_plexon, llm_was_called)."""
        qres = self._qdrant.query_points(
            collection_name=self._collection,
            query=query_embedding,
            limit=20,
            with_payload=True,
            with_vectors=False,
        )
        search = qres.points if hasattr(qres, "points") else []

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
            msg = self._anthropic.messages.create(
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
            return [], {}, False

        usage_raw = raw_units_from_anthropic_message(msg)
        text_blocks = [b for b in msg.content if getattr(b, "type", None) == "text"]
        text_content = text_blocks[0].text if text_blocks else ""
        logger.info("persona.discovery.response_received", length=len(text_content), preview=text_content[:200])

        json_match = re.search(r"```(?:json)?\s*(\[.*?\])\s*```", text_content, re.DOTALL)
        if json_match:
            text_content = json_match.group(1)
        else:
            json_match = re.search(r"\[.*\]", text_content, re.DOTALL)
            if json_match:
                text_content = json_match.group(0)

        try:
            parsed = json.loads(text_content)
        except Exception as exc:  # noqa: BLE001
            logger.warning("persona.discovery.parse_failed", error=str(exc), content_preview=text_content[:500])
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

