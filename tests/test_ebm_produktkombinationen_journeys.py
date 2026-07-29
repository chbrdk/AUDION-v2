"""Tests for EBM Produktkombinationen journey task pack + runner helpers."""
from __future__ import annotations

import importlib.util
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
URLS_PATH = ROOT / "knowledge" / "urls.json"
TASKS_PATH = ROOT / "knowledge" / "ebm-produktkombinationen-journey-tasks.json"
SCRIPT_PATH = ROOT / "scripts" / "run-ebm-produktkombinationen-journeys.py"


def load_runner():
    spec = importlib.util.spec_from_file_location("ebm_journey_runner", SCRIPT_PATH)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    sys.modules["ebm_journey_runner"] = mod
    spec.loader.exec_module(mod)
    return mod


class EbmJourneyTasksTest(unittest.TestCase):
    def test_urls_json_has_required_keys(self):
        urls = json.loads(URLS_PATH.read_text(encoding="utf-8"))
        self.assertIn("bosch.ebike.produktkombinationen", urls)
        self.assertTrue(urls["bosch.ebike.produktkombinationen"].startswith("https://"))
        self.assertIn("audion.uxJourneyAgent.local", urls)

    def test_tasks_file_structure(self):
        tasks = json.loads(TASKS_PATH.read_text(encoding="utf-8"))
        self.assertEqual(tasks["urlKey"], "bosch.ebike.produktkombinationen")
        run_ids = [r["id"] for r in tasks["runs"]]
        self.assertEqual(run_ids, ["A-erstkontakt", "B-aufgabe1-nachruesten", "C-aufgabe2-kombination"])
        for run in tasks["runs"]:
            self.assertIn("task", run)
            self.assertGreater(len(run["task"]), 80)
            self.assertIn(run["personaKey"], tasks["personas"])
            self.assertIsInstance(run["max_steps"], int)

    def test_build_payload_includes_persona_and_url(self):
        runner = load_runner()
        urls = runner.load_json(URLS_PATH)
        tasks = runner.load_json(TASKS_PATH)
        page = runner.resolve_url(urls, tasks["urlKey"])
        run = tasks["runs"][1]
        payload = runner.build_payload(run, page, tasks["personas"])
        self.assertEqual(payload["url"], page)
        self.assertIn("Performance Line", payload["task"])
        self.assertEqual(payload["max_steps"], 40)
        self.assertEqual(payload["persona"]["name"], "eBike-Besitzer Nachrüst-Interesse")

    def test_dry_run_writes_payloads(self):
        runner = load_runner()
        code = runner.main(["--dry-run"])
        self.assertEqual(code, 0)
        out = ROOT / "test-results" / "ebm-produktkombinationen-journeys"
        for rid in ("A-erstkontakt", "B-aufgabe1-nachruesten", "C-aufgabe2-kombination"):
            path = out / f"{rid}.payload.json"
            self.assertTrue(path.is_file(), path)
            data = json.loads(path.read_text(encoding="utf-8"))
            self.assertIn("url", data)
            self.assertIn("task", data)


if __name__ == "__main__":
    unittest.main()
