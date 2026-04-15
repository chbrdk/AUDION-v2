# Knowledge Explorer: Clustering-Fehler (500)

## Häufige Ursache (behoben)

**K-Means** verlangt `1 <= n_clusters <= n_samples`. Wenn nur **ein** Chunk mit Embedding existierte, setzte der Code `n_clusters` fälschlich auf **2** (`max(2, n//2)`), was sklearn mit einem Sample wirft → API **500** mit `Cluster chunks failed`.

Fix in `apps/api/app/services/knowledge_explorer.py`: `n_clusters` wird auf `n_samples` begrenzt; bei einem Sample wird `n_clusters = 1` verwendet.

## Weitere Robustheit

- **Embeddings normalisieren**: Qdrant kann **benannte Vektoren** (`dict`) liefern — es wird der erste nicht-leere Vektor verwendet; ungültige Werte werden entfernt (Chunk gilt dann als ohne Embedding).
- **Stack-Fehler**: unterschiedliche Embedding-Längen führen zu klarem `ValueError` + Log statt undokumentiertem Absturz.

## Tests

`apps/api/tests/test_knowledge_explorer_clustering.py` (K-Means mit einem Sample, Normalisierung).
