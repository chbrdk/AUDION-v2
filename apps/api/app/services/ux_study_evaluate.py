"""UX Study / Wave evaluate + compare (ported from compare-ebm-evaluations.py)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


SUPPORT_ORDER = {
    "not_tested": -1,
    "inconclusive": 0,
    "partially_supported": 0.5,
    "supported": 1,
    "refuted": -1,
}

AGG_KEYS = [
    "taskCompletionRate",
    "validEvidenceRate",
    "infrastructureBlockRate",
    "meanFrictionValidOnly",
    "meanPersonaFitValidOnly",
    "runsTaskCompleted",
    "runsValidEvidence",
]

SOFT_KEYS = [
    "Q1_nuetzlichkeit",
    "Q2_bedienbarkeit",
    "Q3_filterlogik",
    "Q6_nutzungswahrscheinlichkeit",
    "Q7_gesamteindruck",
]


def infer_valid_evidence(
    *,
    blockers: list[str] | None,
    task_completed: bool | None,
    goal_reached: bool | None,
    agent_success: bool | None,
) -> tuple[bool, str | None]:
    """Heuristic: persistent 403 / failed agent / incomplete goal → invalid evidence."""
    blockers = blockers or []
    hard = {"cloudfront_403", "http_403", "blocked", "unavailable"}
    if any(b in hard for b in blockers):
        return False, "infrastructure blocker"
    if agent_success is False:
        return False, "agent reported success=false"
    if task_completed is True or goal_reached is True:
        caveat = None
        if any("403" in b or "archive" in b for b in blockers):
            caveat = "partial infrastructure friction; treat with caution"
        return True, caveat
    return False, "task not completed / goal not reached"


def _mean(nums: list[float]) -> float | None:
    if not nums:
        return None
    return sum(nums) / len(nums)


def build_evaluation(
    *,
    study_id: str,
    wave_id: str,
    runs: list[dict[str, Any]],
    prior_hypotheses: list[dict[str, Any]] | None = None,
    prior_soft: dict[str, Any] | None = None,
    notes: list[str] | None = None,
) -> dict[str, Any]:
    valid = [r for r in runs if r.get("validEvidence") is True]
    completed = [r for r in runs if r.get("taskCompleted") is True]
    blocked = [r for r in runs if (r.get("blockers") or [])]
    segments_covered = sorted({r.get("segment") for r in valid if r.get("segment")})
    all_segments = sorted({r.get("segment") for r in runs if r.get("segment")})
    segments_missing = [s for s in all_segments if s not in segments_covered]

    hypotheses = prior_hypotheses or []
    soft = prior_soft or {"basis": "validEvidence-only rule evaluate"}

    return {
        "schemaVersion": "1.0.0",
        "studyId": study_id,
        "waveId": wave_id,
        "evaluatedAt": datetime.now(timezone.utc).isoformat(),
        "method": "audion_ux_journey_agent",
        "aggregate": {
            "runsTotal": len(runs),
            "runsTaskCompleted": len(completed),
            "runsValidEvidence": len(valid),
            "taskCompletionRate": (len(completed) / len(runs)) if runs else 0.0,
            "validEvidenceRate": (len(valid) / len(runs)) if runs else 0.0,
            "infrastructureBlockRate": (len(blocked) / len(runs)) if runs else 0.0,
            "meanFrictionValidOnly": _mean(
                [float(r["frictionScore"]) for r in valid if isinstance(r.get("frictionScore"), (int, float))]
            ),
            "meanPersonaFitValidOnly": _mean(
                [float(r["personaFitScore"]) for r in valid if isinstance(r.get("personaFitScore"), (int, float))]
            ),
            "goalReachedRateValidOnly": (
                (sum(1 for r in valid if r.get("goalReached") is True) / len(valid)) if valid else None
            ),
            "segmentsCoveredWithValidEvidence": segments_covered,
            "segmentsMissingValidEvidence": segments_missing,
        },
        "hypotheses": hypotheses,
        "softScores": soft,
        "notes": notes
        or [
            "Only runs with validEvidence=true feed friction/fit/goal aggregates.",
            "Soft-Q and hypothesis verdicts may be preserved from prior evaluation.",
        ],
    }


def _soft_num(ev: dict[str, Any], key: str) -> float | None:
    block = (ev.get("softScores") or {}).get(key) or {}
    val = block.get("value")
    if isinstance(val, (int, float)):
        return float(val)
    return None


def compare_evaluations(baseline: dict[str, Any], current: dict[str, Any]) -> dict[str, Any]:
    """Same delta shape as scripts/compare-ebm-evaluations.py."""
    ba = baseline.get("aggregate") or {}
    ca = current.get("aggregate") or {}
    aggregate_delta: dict[str, Any] = {}
    for k in AGG_KEYS:
        b, c = ba.get(k), ca.get(k)
        if isinstance(b, (int, float)) and isinstance(c, (int, float)):
            aggregate_delta[k] = {"baseline": b, "current": c, "delta": c - b}
        else:
            aggregate_delta[k] = {"baseline": b, "current": c, "delta": None}

    soft_delta: dict[str, Any] = {}
    for k in SOFT_KEYS:
        b, c = _soft_num(baseline, k), _soft_num(current, k)
        soft_delta[k] = {
            "baseline": b,
            "current": c,
            "delta": None if b is None or c is None else c - b,
        }

    bh = {str(h["id"]): h for h in (baseline.get("hypotheses") or []) if isinstance(h, dict) and h.get("id")}
    ch = {str(h["id"]): h for h in (current.get("hypotheses") or []) if isinstance(h, dict) and h.get("id")}
    hyp_delta = []
    for hid in sorted(set(bh) | set(ch)):
        b = bh.get(hid) or {}
        c = ch.get(hid) or {}
        bv, cv = b.get("verdict"), c.get("verdict")
        bs, cs = b.get("score"), c.get("score")
        score_delta = None
        if isinstance(bs, (int, float)) and isinstance(cs, (int, float)):
            score_delta = cs - bs
        hyp_delta.append(
            {
                "id": hid,
                "baselineVerdict": bv,
                "currentVerdict": cv,
                "changed": bv != cv,
                "baselineScore": bs,
                "currentScore": cs,
                "scoreDelta": score_delta,
                "supportDelta": (
                    None
                    if bv not in SUPPORT_ORDER or cv not in SUPPORT_ORDER
                    else SUPPORT_ORDER[cv] - SUPPORT_ORDER[bv]
                ),
            }
        )

    br = {
        r["runId"]: r
        for r in (baseline.get("runs") or [])
        if isinstance(r, dict) and r.get("runId")
    }
    cr = {
        r["runId"]: r
        for r in (current.get("runs") or [])
        if isinstance(r, dict) and r.get("runId")
    }
    # also accept runKey
    if not br:
        br = {
            r.get("runKey") or r.get("runId"): r
            for r in (baseline.get("runs") or [])
            if isinstance(r, dict) and (r.get("runKey") or r.get("runId"))
        }
    if not cr:
        cr = {
            r.get("runKey") or r.get("runId"): r
            for r in (current.get("runs") or [])
            if isinstance(r, dict) and (r.get("runKey") or r.get("runId"))
        }

    run_delta = []
    for rid in sorted(set(br) | set(cr)):
        b, c = br.get(rid) or {}, cr.get(rid) or {}
        bf, cf = b.get("frictionScore"), c.get("frictionScore")
        run_delta.append(
            {
                "runId": rid,
                "baselineValid": b.get("validEvidence"),
                "currentValid": c.get("validEvidence"),
                "baselineTaskCompleted": b.get("taskCompleted"),
                "currentTaskCompleted": c.get("taskCompleted"),
                "baselineFriction": bf,
                "currentFriction": cf,
                "frictionDelta": (
                    None
                    if not isinstance(bf, (int, float)) or not isinstance(cf, (int, float))
                    else cf - bf
                ),
            }
        )

    improved: list[str] = []
    worsened: list[str] = []
    better_when_higher = {
        "taskCompletionRate",
        "validEvidenceRate",
        "meanPersonaFitValidOnly",
    }
    better_when_lower = {"infrastructureBlockRate", "meanFrictionValidOnly"}
    for k, row in aggregate_delta.items():
        d = row.get("delta")
        if d is None:
            continue
        if k in better_when_higher:
            if d > 0:
                improved.append(k)
            elif d < 0:
                worsened.append(k)
        if k in better_when_lower:
            if d < 0:
                improved.append(k)
            elif d > 0:
                worsened.append(k)

    return {
        "baselineWaveId": baseline.get("waveId"),
        "currentWaveId": current.get("waveId"),
        "aggregateDelta": aggregate_delta,
        "softScoreDelta": soft_delta,
        "hypothesisDelta": hyp_delta,
        "runDelta": run_delta,
        "improved": improved,
        "worsened": worsened,
        "summary": (
            "Self-compare: numeric deltas are 0 when evaluations match."
            if baseline.get("waveId") == current.get("waveId")
            else f"Compared {current.get('waveId')} vs baseline {baseline.get('waveId')}."
        ),
    }


def apply_agent_result_to_run(run: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    """Merge UX Journey Agent job payload into a run item dict."""
    status = payload.get("status") or payload.get("agentStatus")
    result = payload.get("result") if isinstance(payload.get("result"), dict) else payload
    scorecard = result.get("scorecard") if isinstance(result.get("scorecard"), dict) else {}
    success = result.get("success")
    if success is None:
        success = payload.get("success")
    task_completed = result.get("taskCompleted")
    if task_completed is None:
        task_completed = scorecard.get("taskCompleted")
    goal_reached = scorecard.get("goalReached")
    if goal_reached is None:
        goal_reached = result.get("goalReached")
    friction = scorecard.get("frictionScore")
    persona_fit = scorecard.get("personaFitScore")
    steps = result.get("steps") or result.get("stepsCount") or scorecard.get("steps")
    blockers = list(run.get("blockers") or [])
    # detect 403 hints in findings / error
    err = str(payload.get("error") or result.get("error") or "")
    finding = result.get("finding") or run.get("finding")
    if "403" in err or "403" in str(finding or ""):
        if "cloudfront_403" not in blockers:
            blockers.append("cloudfront_403")
    valid, caveat = infer_valid_evidence(
        blockers=blockers,
        task_completed=bool(task_completed) if task_completed is not None else None,
        goal_reached=bool(goal_reached) if goal_reached is not None else None,
        agent_success=bool(success) if success is not None else None,
    )
    out = dict(run)
    out.update(
        {
            "agentStatus": status,
            "agentSuccess": success,
            "taskCompleted": task_completed,
            "goalReached": goal_reached,
            "frictionScore": friction,
            "personaFitScore": persona_fit,
            "steps": steps if isinstance(steps, int) else out.get("steps"),
            "blockers": blockers,
            "validEvidence": valid,
            "validEvidenceCaveat": caveat,
            "categories": scorecard.get("categories") or out.get("categories") or {},
            "finding": finding,
            "jobId": payload.get("jobId") or payload.get("job_id") or out.get("jobId"),
        }
    )
    return out
