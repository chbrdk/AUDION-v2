"""Tests for EBM evaluation schema + wave comparison."""
from __future__ import annotations

import importlib.util
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EVAL_PATH = ROOT / "knowledge" / "ebm-produktkombinationen-evaluation-audion-2026-07-30.json"
COMPARE_SCRIPT = ROOT / "scripts" / "compare-ebm-evaluations.py"


def load_compare():
    spec = importlib.util.spec_from_file_location("ebm_compare", COMPARE_SCRIPT)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    sys.modules["ebm_compare"] = mod
    spec.loader.exec_module(mod)
    return mod


class EbmEvaluationCompareTest(unittest.TestCase):
    def test_evaluation_schema_baseline(self):
        ev = json.loads(EVAL_PATH.read_text(encoding="utf-8"))
        self.assertEqual(ev["waveId"], "audion-2026-07-30-mcp")
        self.assertEqual(len(ev["runs"]), 3)
        self.assertEqual(ev["aggregate"]["runsValidEvidence"], 1)
        self.assertEqual(ev["softScores"]["Q2_bedienbarkeit"]["value"], 2)
        self.assertEqual(ev["hypotheses"][0]["id"], "H1")
        self.assertIn("comparisonKeys", ev)

    def test_self_compare_zero_delta(self):
        mod = load_compare()
        ev = mod.load(EVAL_PATH)
        delta = mod.compare(ev, ev)
        self.assertEqual(delta["improved"], [])
        self.assertEqual(delta["worsened"], [])
        for row in delta["aggregateDelta"].values():
            if row["delta"] is not None:
                self.assertEqual(row["delta"], 0)

    def test_compare_detects_improvement(self):
        mod = load_compare()
        baseline = mod.load(EVAL_PATH)
        current = json.loads(json.dumps(baseline))
        current["waveId"] = "audion-future-wave"
        current["aggregate"]["validEvidenceRate"] = 1.0
        current["aggregate"]["infrastructureBlockRate"] = 0.0
        current["aggregate"]["meanFrictionValidOnly"] = 4.0
        current["softScores"]["Q2_bedienbarkeit"]["value"] = 4
        current["softScores"]["Q7_gesamteindruck"]["value"] = 2
        current["hypotheses"][2]["verdict"] = "supported"
        current["hypotheses"][2]["score"] = 1
        delta = mod.compare(baseline, current)
        self.assertIn("validEvidenceRate", delta["improved"])
        self.assertIn("infrastructureBlockRate", delta["improved"])
        self.assertIn("meanFrictionValidOnly", delta["improved"])
        self.assertIn("Q2_bedienbarkeit", delta["improved"])
        self.assertIn("Q7_gesamteindruck", delta["improved"])
        h3 = next(h for h in delta["hypothesisDelta"] if h["id"] == "H3")
        self.assertTrue(h3["changed"])


if __name__ == "__main__":
    unittest.main()
