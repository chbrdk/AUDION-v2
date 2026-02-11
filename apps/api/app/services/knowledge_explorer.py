from __future__ import annotations

from typing import Dict, List
from uuid import UUID

import structlog
import numpy as np
from sklearn.cluster import KMeans, DBSCAN
from sklearn.decomposition import PCA
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..models import DocumentChunk, Document, TargetGroupSource

logger = structlog.get_logger(__name__)
settings = get_settings()


class KnowledgeExplorerService:
    """Service to explore and cluster knowledge chunks for target groups."""

    def __init__(self):
        # Determine which Qdrant to use based on STORION proxy setting
        if settings.use_storion_proxy and settings.storion_qdrant_url:
            # Use STORION's Qdrant directly
            self._qdrant = QdrantClient(settings.storion_qdrant_url, check_compatibility=False)
            self._collection = settings.storion_global_collection
            self._use_storion = True
            logger.info(
                "knowledge_explorer.using_storion_qdrant",
                qdrant_url=settings.storion_qdrant_url,
                collection=self._collection,
            )
        else:
            # Use local Qdrant (fallback or standalone mode)
            self._qdrant = QdrantClient(settings.qdrant_url, check_compatibility=False)
            self._collection = "research_chunks"
            self._use_storion = False
            logger.info(
                "knowledge_explorer.using_local_qdrant",
                qdrant_url=settings.qdrant_url,
                collection=self._collection,
            )

    def get_chunks_for_target_group(
        self,
        session: Session,
        target_group_id: str,
        limit: int = 1000,
    ) -> List[Dict]:
        """
        Retrieve all chunks for a target group with full metadata including embeddings.

        Args:
            session: Database session
            target_group_id: Target group UUID string
            limit: Maximum number of chunks to retrieve

        Returns:
            List of chunk dictionaries with metadata and embeddings
        """
        try:
            UUID(target_group_id)
        except ValueError as exc:
            logger.error("knowledge_explorer.invalid_target_group_id", target_group_id=target_group_id)
            raise ValueError("invalid_target_group_id") from exc

        if self._use_storion:
            # Read directly from STORION's Qdrant collection
            return self._get_chunks_from_storion_qdrant(session, target_group_id, limit)
        else:
            # Fallback to local implementation (backward compatibility)
            return self._get_chunks_from_local(session, target_group_id, limit)

    def _get_chunks_from_storion_qdrant(
        self,
        session: Session,
        target_group_id: str,
        limit: int,
    ) -> List[Dict]:
        """Get chunks directly from STORION's Qdrant collection."""
        try:
            # Use scroll to get all chunks for this target group
            # Filter by target_group_ids array in payload
            search_filter = qmodels.Filter(
                must=[
                    qmodels.FieldCondition(
                        key="target_group_ids",
                        match=qmodels.MatchAny(any=[target_group_id]),
                    )
                ]
            )

            # Scroll through all points matching the filter
            scroll_result = self._qdrant.scroll(
                collection_name=self._collection,
                scroll_filter=search_filter,
                limit=limit,
                with_payload=True,
                with_vectors=True,
            )

            points, _ = scroll_result
            if not points:
                logger.info("knowledge_explorer.no_chunks_in_storion", target_group_id=target_group_id)
                return []

            logger.info(
                "knowledge_explorer.chunks_from_storion",
                target_group_id=target_group_id,
                chunks_count=len(points),
            )

            # Get document lookup for filenames (from local DB)
            # chunk_ids = [str(point.id) for point in points]
            document_ids = set()
            for point in points:
                payload = point.payload or {}
                file_id = payload.get("file_id")
                if file_id:
                    # Try to find document by STORION file_id (stored in object_key)
                    doc = session.scalar(
                        select(Document).where(Document.object_key == file_id).limit(1)
                    )
                    if doc:
                        document_ids.add(doc.id)

            if document_ids:
                session.scalars(
                    select(Document).where(Document.id.in_(document_ids))
                ).all()
            # document_map = {str(doc.id): doc for doc in documents}

            # Build result from Qdrant points
            result = []
            for point in points:
                payload = point.payload or {}
                chunk_id_str = str(point.id)
                content = payload.get("content", "")
                
                # Get document info
                file_id = payload.get("file_id", "")
                document = None
                if file_id:
                    # Find document by STORION file_id
                    doc = session.scalar(
                        select(Document).where(Document.object_key == file_id).limit(1)
                    )
                    if doc:
                        document = doc

                result.append({
                    "id": chunk_id_str,
                    "content": content,
                    "document_id": str(document.id) if document else None,
                    "document_filename": document.filename if document else None,
                    "order": payload.get("order", payload.get("chunk_index", 0)),
                    "embedding": point.vector if point.vector else None,
                    "relevance_score": 1.0,  # Default relevance (could be enhanced)
                    "metadata": payload.get("metadata", {}),
                })

            logger.info(
                "knowledge_explorer.chunks_retrieved_from_storion",
                target_group_id=target_group_id,
                chunk_count=len(result),
                embeddings_count=sum(1 for r in result if r.get("embedding")),
            )

            return result

        except Exception as exc:
            logger.error(
                "knowledge_explorer.storion_qdrant_failed",
                target_group_id=target_group_id,
                error=str(exc),
                exc_info=True,
            )
            raise

    def _get_chunks_from_local(
        self,
        session: Session,
        target_group_id: str,
        limit: int,
    ) -> List[Dict]:
        """Get chunks from local Qdrant collection (backward compatibility)."""
        tg_uuid = UUID(target_group_id)

        # Get chunk IDs from TargetGroupSource ordered by relevance
        sources = session.scalars(
            select(TargetGroupSource)
            .where(TargetGroupSource.target_group_id == tg_uuid)
            .order_by(TargetGroupSource.relevance_score.desc())
            .limit(limit)
        ).all()

        if not sources:
            logger.info("knowledge_explorer.no_sources", target_group_id=target_group_id)
            return []

        chunk_ids = [str(source.chunk_id) for source in sources]
        logger.info(
            "knowledge_explorer.found_sources",
            target_group_id=target_group_id,
            source_count=len(chunk_ids),
        )

        # Retrieve chunks from database
        chunks = session.scalars(
            select(DocumentChunk)
            .where(DocumentChunk.id.in_([UUID(cid) for cid in chunk_ids]))
        ).all()

        if not chunks:
            logger.warning(
                "knowledge_explorer.no_chunks_found",
                target_group_id=target_group_id,
                chunk_ids=chunk_ids[:5],
            )
            return []

        # Retrieve embeddings and payloads from Qdrant
        try:
            qdrant_points = self._qdrant.retrieve(
                collection_name=self._collection,
                ids=chunk_ids,
                with_vectors=True,
                with_payload=True,
            )
        except Exception as exc:
            logger.error(
                "knowledge_explorer.qdrant_retrieve_failed",
                target_group_id=target_group_id,
                error=str(exc),
            )
            raise

        # Build lookup maps
        embedding_map = {str(point.id): point.vector for point in qdrant_points if point.vector}
        payload_map = {str(point.id): point.payload or {} for point in qdrant_points}

        # Build chunk lookup by ID
        chunk_map = {str(chunk.id): chunk for chunk in chunks}

        # Get document lookup for filenames
        document_ids = {chunk.document_id for chunk in chunks}
        documents = session.scalars(
            select(Document).where(Document.id.in_(document_ids))
        ).all()
        document_map = {str(doc.id): doc for doc in documents}

        # Build relevance score lookup
        relevance_map = {str(source.chunk_id): source.relevance_score for source in sources}

        # Combine data in order of relevance
        result = []
        for chunk_id_str in chunk_ids:
            chunk = chunk_map.get(chunk_id_str)
            if not chunk:
                logger.warning(
                    "knowledge_explorer.chunk_not_found",
                    chunk_id=chunk_id_str,
                    target_group_id=target_group_id,
                )
                continue

            document = document_map.get(str(chunk.document_id))
            embedding = embedding_map.get(chunk_id_str)
            payload = payload_map.get(chunk_id_str, {})

            result.append({
                "id": chunk_id_str,
                "content": chunk.content,
                "document_id": str(chunk.document_id),
                "document_filename": document.filename if document else None,
                "order": payload.get("order", 0),
                "embedding": embedding,
                "relevance_score": relevance_map.get(chunk_id_str, 1.0),
                "metadata": chunk.chunk_metadata or {},
            })

        logger.info(
            "knowledge_explorer.chunks_retrieved",
            target_group_id=target_group_id,
            chunk_count=len(result),
            embeddings_count=sum(1 for r in result if r.get("embedding")),
        )

        return result

    def cluster_chunks(
        self,
        chunks: List[Dict],
        method: str = "kmeans",
        n_clusters: int = 10,
        min_samples: int = 3,
    ) -> Dict:
        """
        Cluster chunks based on their embeddings.

        Args:
            chunks: List of chunk dictionaries with embeddings
            method: Clustering method ("kmeans" or "dbscan")
            n_clusters: Number of clusters for K-Means (ignored for DBSCAN)
            min_samples: Minimum samples for DBSCAN (ignored for K-Means)

        Returns:
            Dictionary with clusters, coordinates, and labels
        """
        if not chunks:
            logger.warning("knowledge_explorer.cluster_empty_chunks")
            return {
                "clusters": [],
                "coordinates_2d": [],
                "cluster_labels": [],
                "method": method,
            }

        # Filter chunks with embeddings
        chunks_with_embeddings = [chunk for chunk in chunks if chunk.get("embedding")]

        if not chunks_with_embeddings:
            logger.warning("knowledge_explorer.cluster_no_embeddings")
            return {
                "clusters": [],
                "coordinates_2d": [],
                "cluster_labels": [-1] * len(chunks),  # Mark all as noise
                "method": method,
            }

        # Extract embeddings
        embeddings = np.array([chunk["embedding"] for chunk in chunks_with_embeddings])

        logger.info(
            "knowledge_explorer.clustering_start",
            method=method,
            n_chunks=len(embeddings),
            n_clusters=n_clusters if method == "kmeans" else None,
        )

        # Perform clustering
        if method == "kmeans":
            if n_clusters > len(embeddings):
                n_clusters = max(2, len(embeddings) // 2)
                logger.warning(
                    "knowledge_explorer.adjusted_clusters",
                    adjusted_n_clusters=n_clusters,
                    n_chunks=len(embeddings),
                )
            clusterer = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
            cluster_labels = clusterer.fit_predict(embeddings)
        elif method == "dbscan":
            clusterer = DBSCAN(min_samples=min_samples, eps=0.5)
            cluster_labels = clusterer.fit_predict(embeddings)
        else:
            raise ValueError(f"Unknown clustering method: {method}")

        # Reduce to 2D for visualization (PCA)
        if len(embeddings) > 1:
            n_components = min(2, len(embeddings) - 1)
            pca = PCA(n_components=n_components, random_state=42)
            coordinates_2d = pca.fit_transform(embeddings).tolist()
            # If only 1 component, add second dimension as zeros
            if n_components == 1:
                coordinates_2d = [[coord[0], 0.0] for coord in coordinates_2d]
        else:
            coordinates_2d = [[0.0, 0.0]]

        # Map cluster labels back to all chunks (chunks without embeddings get -1)
        all_labels = []
        embed_idx = 0
        for chunk in chunks:
            if chunk.get("embedding"):
                all_labels.append(int(cluster_labels[embed_idx]))
                embed_idx += 1
            else:
                all_labels.append(-1)  # Mark as noise/unclustered

        # Build cluster summaries
        clusters_dict: Dict[int, Dict] = {}
        for idx, label in enumerate(all_labels):
            if label not in clusters_dict:
                clusters_dict[label] = {
                    "id": int(label),
                    "chunk_ids": [],
                    "size": 0,
                }
            clusters_dict[label]["chunk_ids"].append(chunks[idx]["id"])
            clusters_dict[label]["size"] += 1

        # Generate cluster topics/names
        cluster_summaries = self._summarize_clusters(chunks_with_embeddings, cluster_labels, list(clusters_dict.keys()))

        # Add summaries to clusters
        for cluster_id, summary in cluster_summaries.items():
            if cluster_id in clusters_dict:
                clusters_dict[cluster_id]["topic"] = summary.get("topic", f"Cluster {cluster_id}")
                clusters_dict[cluster_id]["description"] = summary.get("description", "")

        result = {
            "clusters": list(clusters_dict.values()),
            "coordinates_2d": coordinates_2d,
            "cluster_labels": all_labels,
            "method": method,
        }

        logger.info(
            "knowledge_explorer.clustering_complete",
            method=method,
            n_clusters=len(clusters_dict),
            cluster_sizes=[c["size"] for c in clusters_dict.values()],
        )

        return result

    def _summarize_clusters(
        self,
        chunks: List[Dict],
        labels: np.ndarray,
        cluster_ids: List[int],
    ) -> Dict[int, Dict]:
        """
        Generate topic names for clusters using LLM.

        Args:
            chunks: List of chunk dictionaries
            labels: Cluster labels array
            cluster_ids: List of unique cluster IDs

        Returns:
            Dictionary mapping cluster_id to {topic, description}
        """
        summaries = {}

        for cluster_id in cluster_ids:
            if cluster_id == -1:  # Noise in DBSCAN
                summaries[cluster_id] = {
                    "topic": "Other",
                    "description": "Unclustered chunks",
                }
                continue

            # Get chunks in this cluster
            cluster_chunks = [chunks[i] for i, label in enumerate(labels) if label == cluster_id]

            # Sample top 3 chunks by relevance or first 3
            sample_chunks = sorted(cluster_chunks, key=lambda x: x.get("relevance_score", 0.0), reverse=True)[:3]
            sample_texts = [chunk["content"][:200] for chunk in sample_chunks]

            # Generate topic from sample texts (simplified - could use LLM later)
            # For now, use first few words from first chunk
            if sample_texts and sample_texts[0]:
                first_words = sample_texts[0].split()[:5]
                topic = " ".join(first_words)
                if len(topic) > 50:
                    topic = topic[:47] + "..."
            else:
                topic = f"Cluster {cluster_id}"

            summaries[cluster_id] = {
                "topic": topic,
                "description": f"{len(cluster_chunks)} related chunks",
            }

        return summaries

    def get_similar_chunks(
        self,
        chunk_id: str,
        target_group_id: str,
        limit: int = 10,
    ) -> List[Dict]:
        """
        Find similar chunks to a given chunk.

        Args:
            chunk_id: Chunk UUID string
            target_group_id: Target group UUID string for filtering
            limit: Maximum number of similar chunks to return

        Returns:
            List of similar chunk dictionaries with similarity scores
        """
        # Get the chunk's embedding from Qdrant
        try:
            points = self._qdrant.retrieve(
                collection_name=self._collection,
                ids=[chunk_id],
                with_vectors=True,
            )
        except Exception as exc:
            logger.error("knowledge_explorer.retrieve_chunk_failed", chunk_id=chunk_id, error=str(exc))
            raise

        if not points or not points[0].vector:
            logger.warning("knowledge_explorer.chunk_embedding_not_found", chunk_id=chunk_id)
            return []

        embedding = points[0].vector

        # Search for similar chunks in the same target group using query_points (new API)
        try:
            # Use appropriate filter based on STORION or local mode
            if self._use_storion:
                search_filter = qmodels.Filter(
                    must=[
                        qmodels.FieldCondition(
                            key="target_group_ids",
                            match=qmodels.MatchAny(any=[target_group_id]),
                        )
                    ]
                )
            else:
                search_filter = qmodels.Filter(
                    must=[
                        qmodels.FieldCondition(
                            key="target_group_id",
                            match=qmodels.MatchValue(value=target_group_id),
                        )
                    ]
                )
            # Use query_points instead of search for newer Qdrant client versions
            # The query parameter accepts a vector directly
            query_result = self._qdrant.query_points(
                collection_name=self._collection,
                query=embedding,  # Direct vector, not NearestQuery object
                query_filter=search_filter,
                limit=limit + 1,  # +1 to exclude the original chunk
                with_payload=True,
                with_vectors=False,
            )
            # query_points returns a QueryResponse with points
            results = query_result.points if hasattr(query_result, 'points') else []
        except Exception as exc:
            logger.error(
                "knowledge_explorer.search_failed",
                chunk_id=chunk_id,
                target_group_id=target_group_id,
                error=str(exc),
            )
            raise

        similar = []
        for hit in results:
            # query_points returns ScoredPoint objects
            hit_id = str(hit.id) if hasattr(hit, 'id') else str(getattr(hit, 'point_id', ''))
            if hit_id != chunk_id:  # Exclude original chunk
                score = float(hit.score) if hasattr(hit, 'score') else 0.0
                payload = hit.payload if hasattr(hit, 'payload') else {}
                similar.append({
                    "id": hit_id,
                    "content": payload.get("content", "") if payload else "",
                    "similarity": score,
                    "document_id": str(payload.get("document_id", "")) if payload else "",
                })

        logger.info(
            "knowledge_explorer.similar_chunks_found",
            chunk_id=chunk_id,
            similar_count=len(similar),
        )

        return similar

