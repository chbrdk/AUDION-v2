from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, Iterable, List, Optional

from pipelines.config import PATHS


class InsightLoader:
    def __init__(self, insights_dir: Optional[Path] = None):
        self.insights_dir = insights_dir or (PATHS.workspace / "data" / "insights")
        self.insights_dir.mkdir(parents=True, exist_ok=True)

    def lookup(self, persona_id: str) -> List[Dict]:
        matches: List[Dict] = []
        for file in self.insights_dir.glob("*.jsonl"):
            for line in file.read_text().splitlines():
                if not line.strip():
                    continue
                entry = json.loads(line)
                if entry.get("persona_id") == persona_id:
                    matches.append(entry)
        return matches


class ReviewQueue:
    def __init__(self, queue_file: Optional[Path] = None):
        self.queue_file = queue_file or (PATHS.knowledge_dir / "persona_review_queue.jsonl")
        self.queue_file.parent.mkdir(parents=True, exist_ok=True)
        if not self.queue_file.exists():
            self.queue_file.write_text("")

    def enqueue(self, persona: Dict, reason: str) -> None:
        payload = {
            "persona_id": persona["persona_id"],
            "source_id": persona["source_id"],
            "provenance": persona.get("provenance"),
            "reason": reason,
        }
        with self.queue_file.open("a") as fh:
            fh.write(json.dumps(payload) + "\n")


class PersonaEnrichmentPipeline:
    def __init__(self, loader: Optional[InsightLoader] = None, review_queue: Optional[ReviewQueue] = None):
        self.loader = loader or InsightLoader()
        self.review_queue = review_queue or ReviewQueue()

    def enrich_batch(self, personas: Iterable[Dict]) -> List[Dict]:
        enriched = []
        for persona in personas:
            requires_review = persona.get("provenance") != "internal"
            enriched_persona = self.enrich_single(persona)
            enriched.append(enriched_persona)
            if requires_review:
                self.review_queue.enqueue(enriched_persona, reason="requires_manual_validation")
        return enriched

    def enrich_single(self, persona: Dict) -> Dict:
        insights = self.loader.lookup(persona["persona_id"])
        if insights:
            persona["provenance"] = "blended"
            persona.setdefault("metadata", {})["insight_refs"] = [i["insight_id"] for i in insights]
            persona["data_provenance"] = {
                "internal_evidence": len(insights),
                "external_evidence": 1 if persona.get("source_id", "").startswith("persona_src_") else 0,
            }
        else:
            persona["data_provenance"] = {"internal_evidence": 0, "external_evidence": 1}
        return persona


__all__ = ["PersonaEnrichmentPipeline", "InsightLoader", "ReviewQueue"]

