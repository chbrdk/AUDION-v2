"""Regression tests for knowledge chunk clustering (K-Means bounds, embedding shape)."""

import numpy as np

from app.services.knowledge_explorer import KnowledgeExplorerService, _normalize_embedding_vector


def test_normalize_named_vector_dict() -> None:
    v = _normalize_embedding_vector({"default": [0.1, 0.2, 0.3]})
    assert v is not None
    assert v.shape == (3,)
    assert float(v[0]) == 0.1


def test_normalize_plain_list() -> None:
    v = _normalize_embedding_vector([1.0, 2.0])
    assert v is not None
    assert list(v) == [1.0, 2.0]


def test_cluster_chunks_kmeans_single_sample_does_not_crash() -> None:
    """
    sklearn KMeans requires n_clusters <= n_samples.
    A single chunk with default n_clusters=10 must not raise (previously used n_clusters=2).
    """
    svc = KnowledgeExplorerService.__new__(KnowledgeExplorerService)
    chunks = [
        {
            "id": "c1",
            "content": "only chunk",
            "embedding": [0.1] * 16,
            "relevance_score": 1.0,
            "metadata": {},
        }
    ]
    out = svc.cluster_chunks(chunks, method="kmeans", n_clusters=10)
    assert len(out["cluster_labels"]) == 1
    assert out["cluster_labels"][0] in (0,)
    assert len(out["coordinates_2d"]) == 1


def test_cluster_chunks_kmeans_two_samples_high_n_clusters() -> None:
    svc = KnowledgeExplorerService.__new__(KnowledgeExplorerService)
    chunks = [
        {"id": "a", "content": "a", "embedding": [1.0, 0.0], "relevance_score": 1.0, "metadata": {}},
        {"id": "b", "content": "b", "embedding": [0.0, 1.0], "relevance_score": 1.0, "metadata": {}},
    ]
    out = svc.cluster_chunks(chunks, method="kmeans", n_clusters=50)
    assert len(out["cluster_labels"]) == 2
    assert len(np.unique(out["cluster_labels"])) >= 1
