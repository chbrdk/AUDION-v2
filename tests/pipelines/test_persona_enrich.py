import json
from pathlib import Path

from pipelines.persona_enrich import InsightLoader, PersonaEnrichmentPipeline, ReviewQueue


def test_enrichment_sets_blended_when_insights_exist(tmp_path: Path):
    insights_dir = tmp_path / "insights"
    insights_dir.mkdir()
    entry = {
        "insight_id": "ins-1",
        "persona_id": "p-1",
        "type": "interview",
        "summary": "Prefers dashboards",
    }
    (insights_dir / "sample.jsonl").write_text(json.dumps(entry) + "\n")
    loader = InsightLoader(insights_dir)
    queue = ReviewQueue(tmp_path / "queue.jsonl")
    pipeline = PersonaEnrichmentPipeline(loader=loader, review_queue=queue)
    persona = {"persona_id": "p-1", "source_id": "persona_src_synthlabsai", "provenance": "external"}
    enriched = pipeline.enrich_batch([persona])[0]
    assert enriched["provenance"] == "blended"
    assert queue.queue_file.read_text().strip(), "Persona should be queued for review"
