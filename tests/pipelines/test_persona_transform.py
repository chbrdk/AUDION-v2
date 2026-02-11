from pathlib import Path

import pytest

yaml = pytest.importorskip("yaml")  # noqa: F841

from pipelines.persona_transform import PersonaTransformJob  # noqa: E402


def test_transform_job_maps_basic_fields():
    mapping_path = Path("data/mappings/persona_src_synthlabsai.yaml").resolve()
    job = PersonaTransformJob(mapping_path)
    record = {
        "profile_id": "abc123",
        "segment": "Werkstattleiterin",
        "demographic": {
            "age_range": "35-44",
            "gender": "female",
            "locale": "DE-BW",
            "role": "Serviceleiterin",
        },
        "goals": ["Reduce downtime"],
        "jobs_to_be_done": ["Plan maintenance"],
        "sentiment": {"happiness": 4, "effort": 2, "loyalty": 3},
        "embedding": {"model": "text-embed-3-large", "vector": [0.1, 0.2], "dim": 2},
    }
    personas = job.transform_records([record], batch_id="unit-test", write_output=False)
    persona = personas[0]
    assert persona["source_id"] == "persona_src_synthlabsai"
    assert persona["segment"] == "Werkstattleiterin"
    assert persona["embeddings"]["dim"] == 2

