#!/usr/bin/env python3
"""Compare two EBM Produktkombinationen evaluation waves (JSON).

Usage:
  python3 scripts/compare-ebm-evaluations.py \\
    test-results/ebm-produktkombinationen-journeys/evaluation-audion-2026-07-30.json \\
    path/to/newer-evaluation.json

Prints a machine-readable delta summary for wave-to-wave comparison.
Exit 0 always when files parse; exit 2 on schema/IO errors.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


SUPPORT_ORDER = {
    "not_tested": -1,
    "inconclusive": 0,
    "partially_supported": 0.5,
    "supported": 1,
    "refuted": -1,
}


def load(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"Expected object in {path}")
    return data


def hyp_map(ev: dict[str, Any]) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for h in ev.get("hypotheses") or []:
        if isinstance(h, dict) and h.get("id"):
            out[str(h["id"])] = h
    return out


def soft_num(ev: dict[str, Any], key: str) -> float | None:
    block = (ev.get("softScores") or {}).get(key) or {}
    val = block.get("value")
    if isinstance(val, (int, float)):
        return float(val)
    return None


def compare(baseline: dict[str, Any], current: dict[str, Any]) -> dict[str, Any]:
    ba = baseline.get("aggregate") or {}
    ca = current.get("aggregate") or {}
    agg_keys = [
        "taskCompletionRate",
        "validEvidenceRate",
        "infrastructureBlockRate",
        "meanFrictionValidOnly",
        "meanPersonaFitValidOnly",
        "runsTaskCompleted",
        "runsValidEvidence",
    ]
    aggregate_delta = {}
    for k in agg_keys:
        b, c = ba.get(k), ca.get(k)
        if isinstance(b, (int, float)) and isinstance(c, (int, float)):
            aggregate_delta[k] = {"baseline": b, "current": c, "delta": c - b}
        else:
            aggregate_delta[k] = {"baseline": b, "current": c, "delta": None}

    soft_keys = [
        "Q1_nuetzlichkeit",
        "Q2_bedienbarkeit",
        "Q3_filterlogik",
        "Q6_nutzungswahrscheinlichkeit",
        "Q7_gesamteindruck",
    ]
    soft_delta = {}
    for k in soft_keys:
        b, c = soft_num(baseline, k), soft_num(current, k)
        soft_delta[k] = {
            "baseline": b,
            "current": c,
            "delta": (None if b is None or c is None else c - b),
        }

    bh, ch = hyp_map(baseline), hyp_map(current)
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

    # per-run friction compare by runId
    br = {r["runId"]: r for r in (baseline.get("runs") or []) if isinstance(r, dict) and r.get("runId")}
    cr = {r["runId"]: r for r in (current.get("runs") or []) if isinstance(r, dict) and r.get("runId")}
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
                    None if not isinstance(bf, (int, float)) or not isinstance(cf, (int, float)) else cf - bf
                ),
            }
        )

    improved = []
    worsened = []
    # lower friction/block rate = better; higher completion/fit/Q = better
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
        if k in better_when_higher and d > 0:
            improved.append(k)
        elif k in better_when_higher and d < 0:
            worsened.append(k)
        elif k in better_when_lower and d < 0:
            improved.append(k)
        elif k in better_when_lower and d > 0:
            worsened.append(k)

    for k, row in soft_delta.items():
        d = row.get("delta")
        if d is None:
            continue
        # Q7 schulnote: lower is better
        if k == "Q7_gesamteindruck":
            if d < 0:
                improved.append(k)
            elif d > 0:
                worsened.append(k)
        else:
            if d > 0:
                improved.append(k)
            elif d < 0:
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
            f"{current.get('waveId')} vs {baseline.get('waveId')}: "
            f"{len(improved)} improved, {len(worsened)} worsened metrics"
        ),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("baseline", type=Path)
    parser.add_argument("current", type=Path)
    parser.add_argument("-o", "--output", type=Path, help="Write delta JSON here")
    args = parser.parse_args(argv)
    try:
        baseline = load(args.baseline)
        current = load(args.current)
        delta = compare(baseline, current)
    except Exception as e:  # noqa: BLE001
        print(f"ERROR: {e}", file=sys.stderr)
        return 2
    text = json.dumps(delta, ensure_ascii=False, indent=2)
    print(text)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(text + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
