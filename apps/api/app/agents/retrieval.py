from __future__ import annotations

from typing import List, Tuple

from FlagEmbedding import BGEM3FlagModel
from qdrant_client import QdrantClient

from ..core.config import get_settings


class RetrievalAgent:
    def __init__(self) -> None:
        settings = get_settings()
        self._embedder = BGEM3FlagModel("BAAI/bge-m3", use_fp16=True)
        self._qdrant = QdrantClient(settings.qdrant_url)
        self._collection = "research_chunks"

    def run(self, *, query: str, persona_segment: str | None = None) -> Tuple[List[float], list]:
        embedding = self._embedder.encode([query])["dense_vecs"][0]
        search_filter = None
        if persona_segment:
            from qdrant_client.http import models as qmodels

            search_filter = qmodels.Filter(
                must=[
                    qmodels.FieldCondition(
                        key="persona_segment",
                        match=qmodels.MatchValue(value=persona_segment),
                    )
                ]
            )
        hits = self._qdrant.search(
            collection_name=self._collection,
            query_vector=embedding,
            limit=12,
            query_filter=search_filter,
        )
        return embedding, hits

