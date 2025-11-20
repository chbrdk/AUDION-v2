from __future__ import annotations

import datetime as dt
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional


RECENCY_BOOST_DAYS = 90


@dataclass
class PersonaScore:
    persona_id: str
    score: float
    provenance: str
    last_seen_at: Optional[str]


class PersonaRanker:
    def __init__(
        self,
        *,
        internal_weight: float = 1.0,
        external_weight: float = 0.6,
        blended_weight: float = 0.85,
        recency_days: int = RECENCY_BOOST_DAYS,
        recency_factor: float = 0.1,
    ):
        self.internal_weight = internal_weight
        self.external_weight = external_weight
        self.blended_weight = blended_weight
        self.recency_days = recency_days
        self.recency_factor = recency_factor

    def score_persona(self, persona: Dict) -> PersonaScore:
        provenance = persona.get("provenance", "external")
        base = self._base_weight(provenance)
        trust = persona.get("trust_score") or persona.get("metadata", {}).get("trust_score") or 1.0
        last_seen = persona.get("last_seen_at") or persona.get("created_at")
        recency_boost = self._recency_boost(last_seen)
        jobs_bonus = 0.02 * len(persona.get("jobs_to_be_done", []))
        final_score = base * trust * (1 + recency_boost + jobs_bonus)
        return PersonaScore(
            persona_id=persona["persona_id"],
            score=round(final_score, 4),
            provenance=provenance,
            last_seen_at=last_seen,
        )

    def rank(self, personas: Iterable[Dict], *, limit: Optional[int] = None) -> List[Dict]:
        scored = [(self.score_persona(p), p) for p in personas]
        scored.sort(key=lambda item: item[0].score, reverse=True)
        result = [persona for _, persona in scored]
        if limit is not None:
            result = result[:limit]
        return result

    def merge_conflicts(self, personas: Iterable[Dict]) -> List[Dict]:
        merged: Dict[str, Dict] = {}
        for persona in personas:
            pid = persona["persona_id"]
            existing = merged.get(pid)
            if not existing:
                merged[pid] = persona
                continue
            merged[pid] = self._resolve_tie(existing, persona)
        return list(merged.values())

    def _resolve_tie(self, first: Dict, second: Dict) -> Dict:
        priority = {"internal": 3, "blended": 2, "external": 1}
        first_rank = priority.get(first.get("provenance"), 0)
        second_rank = priority.get(second.get("provenance"), 0)
        if first_rank != second_rank:
            return first if first_rank > second_rank else second
        first_seen = first.get("last_seen_at") or ""
        second_seen = second.get("last_seen_at") or ""
        return first if first_seen >= second_seen else second

    def _base_weight(self, provenance: str) -> float:
        if provenance == "internal":
            return self.internal_weight
        if provenance == "blended":
            return self.blended_weight
        return self.external_weight

    def _recency_boost(self, last_seen: Optional[str]) -> float:
        if not last_seen:
            return 0.0
        try:
            ts = dt.datetime.fromisoformat(last_seen.replace("Z", "+00:00"))
        except ValueError:
            return 0.0
        age_days = (dt.datetime.now(dt.timezone.utc) - ts).days
        if age_days < 0:
            return self.recency_factor
        if age_days > self.recency_days:
            return 0.0
        return self.recency_factor * (1 - age_days / self.recency_days)


__all__ = ["PersonaRanker", "PersonaScore"]

