from __future__ import annotations

from typing import List, Tuple
from uuid import UUID

from FlagEmbedding import BGEM3FlagModel
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels

from ..core.config import get_settings
from ..db import get_session
from ..models import TargetGroup


class RetrievalAgent:
    def __init__(self) -> None:
        settings = get_settings()
        self._embedder_instance: BGEM3FlagModel | None = None
        self._qdrant = QdrantClient(settings.qdrant_url)
        self._collection = "research_chunks"

    @property
    def _embedder(self) -> BGEM3FlagModel:
        """Lazy-load the embedder model to avoid loading it at import time."""
        if self._embedder_instance is None:
            self._embedder_instance = BGEM3FlagModel("BAAI/bge-m3", use_fp16=True)
        return self._embedder_instance

    def run(
        self,
        *,
        query: str,
        target_group_id: str | None = None,
        persona_segment: str | None = None,
    ) -> Tuple[List[float], list]:
        embedding = self._embedder.encode([query])["dense_vecs"][0]
        search_filter = None
        
        # Priority: target_group_id > persona_segment (for backward compatibility)
        if target_group_id:
            search_filter = qmodels.Filter(
                must=[
                    qmodels.FieldCondition(
                        key="target_group_id",
                        match=qmodels.MatchValue(value=target_group_id),
                    )
                ]
            )
        elif persona_segment:
            # Backward compatibility: Find target group by segment, then use target_group_id
            # If no target group found, fall back to persona_segment filter
            target_group_id_str = None
            with get_session() as session:
                from sqlalchemy import select
                target_group = session.scalars(
                    select(TargetGroup).where(TargetGroup.segment == persona_segment).limit(1)
                ).first()
                if target_group:
                    target_group_id_str = str(target_group.id)
            
            if target_group_id_str:
                search_filter = qmodels.Filter(
                    must=[
                        qmodels.FieldCondition(
                            key="target_group_id",
                            match=qmodels.MatchValue(value=target_group_id_str),
                        )
                    ]
                )
            else:
                # Fallback to persona_segment filter if target group not found
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

