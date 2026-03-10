from __future__ import annotations

from typing import List, Tuple, TYPE_CHECKING

# Lazy import FlagEmbedding to avoid transformers compatibility issues at startup
# FlagEmbedding 1.3.5 has compatibility issues with newer transformers versions
# We import it only when actually needed, not at module level
if TYPE_CHECKING:
    from FlagEmbedding import BGEM3FlagModel

from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels

from ..core.config import get_settings


class RetrievalAgent:
    def __init__(self) -> None:
        settings = get_settings()
        self._embedder: BGEM3FlagModel | None = None  # Lazy load
        # Disable compatibility check to avoid warnings with Qdrant 1.11.3
        self._qdrant = QdrantClient(
            url=settings.qdrant_url,
            api_key=settings.qdrant_api_key,
            check_compatibility=False,
        )
        self._collection = "research_chunks"
    
    @property
    def embedder(self):
        """Lazy load the embedder model on first use."""
        if self._embedder is None:
            # Import FlagEmbedding only when actually needed
            try:
                from FlagEmbedding import BGEM3FlagModel
                self._embedder = BGEM3FlagModel("BAAI/bge-m3", use_fp16=True)
            except ImportError as e:
                raise ImportError(
                    f"FlagEmbedding konnte nicht importiert werden: {e}. "
                    "Möglicherweise ein Kompatibilitätsproblem mit transformers."
                ) from e
        return self._embedder

    def run(self, *, query: str, persona_segment: str | None = None) -> Tuple[List[float], list]:
        """Retrieve relevant chunks for a query."""
        embedding = self.embedder.encode([query])["dense_vecs"][0]
        query_filter = None
        if persona_segment:
            query_filter = qmodels.Filter(
                must=[
                    qmodels.FieldCondition(
                        key="persona_segment",
                        match=qmodels.MatchValue(value=persona_segment),
                    )
                ]
            )
        # Use query_points instead of search (new API in qdrant-client 1.16+)
        # Reduced limit from 12 to 5 for faster retrieval
        response = self._qdrant.query_points(
            collection_name=self._collection,
            query=embedding,  # Dense vector for nearest search
            limit=5,
            query_filter=query_filter,
            with_payload=True,
            with_vectors=False,
        )
        # Convert QueryResponse to list of hits (similar to old search API)
        hits = response.points if hasattr(response, 'points') else []
        return embedding, hits

