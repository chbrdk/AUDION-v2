import json
from pathlib import Path

import pytest

try:
    import yaml
except ImportError:  # pragma: no cover
    yaml = None


ROOT = Path(__file__).resolve().parents[2]
SCHEMA_PATH = ROOT / "knowledge" / "persona_schema.yaml"
FIXTURE_PATH = ROOT / "data" / "fixtures" / "persona_schema_sample.json"


@pytest.mark.skipif(yaml is None, reason="PyYAML not installed")
def test_schema_contains_required_fields():
    schema = yaml.safe_load(SCHEMA_PATH.read_text())
    required = ["persona_id", "source_id", "provenance", "segment", "goals", "jobs_to_be_done", "created_at"]
    missing = [field for field in required if field not in schema["fields"]]
    assert not missing, f"Missing fields in schema: {missing}"


def test_fixture_matches_core_contract():
    sample = json.loads(FIXTURE_PATH.read_text())
    assert sample["provenance"] == "internal"
    assert sample["source_id"].startswith("persona_src_internal_")
    assert len(sample["goals"]) > 0
    assert len(sample["jobs_to_be_done"]) > 0
    for metric in ("satisfaction", "effort", "adoption"):
        value = sample["ux_metrics"][metric]
        assert 0 <= value <= 1, f"{metric} out of bounds"
    assert len(sample["embeddings"]["vector"]) == sample["embeddings"]["dim"]

