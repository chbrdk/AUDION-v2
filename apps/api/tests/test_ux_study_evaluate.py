"""Pure unit tests for UX study evaluate/compare (no DB / glass_proto)."""

from __future__ import annotations

from app.services.ux_study_evaluate import (
    apply_agent_result_to_run,
    build_evaluation,
    compare_evaluations,
    infer_valid_evidence,
)


def test_infer_valid_evidence_blocks_403():
    ok, reason = infer_valid_evidence(
        blockers=["cloudfront_403"],
        task_completed=True,
        goal_reached=True,
        agent_success=True,
    )
    assert ok is False
    assert reason


def test_infer_valid_evidence_accepts_completed():
    ok, caveat = infer_valid_evidence(
        blockers=["cloudfront_403_intermittent"],
        task_completed=True,
        goal_reached=True,
        agent_success=True,
    )
    assert ok is True
    assert caveat


def test_compare_self_delta_zero():
    runs = [
        {
            "runId": "B",
            "validEvidence": True,
            "taskCompleted": True,
            "blockers": [],
            "frictionScore": 9,
            "personaFitScore": 2,
            "goalReached": True,
            "segment": "owner_upgrade",
        }
    ]
    ev = build_evaluation(study_id="s", wave_id="w", runs=runs, prior_hypotheses=[], prior_soft={})
    delta = compare_evaluations(ev, ev)
    for row in delta["aggregateDelta"].values():
        if isinstance(row["baseline"], (int, float)) and isinstance(row["current"], (int, float)):
            assert row["delta"] == 0


def test_compare_detects_friction_improvement():
    base_runs = [
        {
            "runId": "B",
            "validEvidence": True,
            "taskCompleted": True,
            "blockers": [],
            "frictionScore": 9,
            "personaFitScore": 2,
            "goalReached": True,
            "segment": "owner_upgrade",
        }
    ]
    cur_runs = [
        {
            "runId": "B",
            "validEvidence": True,
            "taskCompleted": True,
            "blockers": [],
            "frictionScore": 5,
            "personaFitScore": 4,
            "goalReached": True,
            "segment": "owner_upgrade",
        }
    ]
    base = build_evaluation(study_id="s", wave_id="w1", runs=base_runs)
    cur = build_evaluation(study_id="s", wave_id="w2", runs=cur_runs)
    delta = compare_evaluations(base, cur)
    assert delta["aggregateDelta"]["meanFrictionValidOnly"]["delta"] == -4
    assert "meanFrictionValidOnly" in delta["improved"]


def test_apply_agent_result_marks_403_invalid():
    merged = apply_agent_result_to_run(
        {"runKey": "A", "blockers": [], "finding": None},
        {
            "status": "complete",
            "jobId": "j1",
            "result": {
                "success": True,
                "taskCompleted": True,
                "error": "CloudFront 403",
                "scorecard": {"goalReached": True, "frictionScore": 8},
            },
        },
    )
    assert merged["validEvidence"] is False
    assert "cloudfront_403" in merged["blockers"]
