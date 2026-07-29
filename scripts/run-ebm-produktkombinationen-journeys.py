#!/usr/bin/env python3
"""Start EBM Produktkombinationen UX Journey runs against AUDION UX Journey Agent.

Reads task definitions from knowledge/ebm-produktkombinationen-journey-tasks.json
and URL keys from knowledge/urls.json (override via env).

Env:
  UX_JOURNEY_AGENT_URL   Agent base (default: urls.json audion.uxJourneyAgent.local)
  EBM_PRODUKTKOMBINATIONEN_URL  Target page override
  EBM_JOURNEY_POLL_SECONDS      Poll interval (default 5)
  EBM_JOURNEY_DRY_RUN           If 1, print payloads and exit without POST
  EBM_JOURNEY_RUN_IDS           Comma list of run ids (default: all)
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
URLS_PATH = ROOT / "knowledge" / "urls.json"
TASKS_PATH = ROOT / "knowledge" / "ebm-produktkombinationen-journey-tasks.json"
OUT_DIR = ROOT / "test-results" / "ebm-produktkombinationen-journeys"


def load_json(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise ValueError(f"Expected object in {path}")
    return data


def resolve_url(urls: dict[str, Any], key: str, env_name: str | None = None) -> str:
    if env_name:
        override = (os.environ.get(env_name) or "").strip()
        if override:
            return override.rstrip("/")
    value = urls.get(key)
    if not isinstance(value, str) or not value.strip():
        raise KeyError(f"Missing URL for key {key!r} in {URLS_PATH}")
    return value.rstrip("/")


def http_json(method: str, url: str, body: dict[str, Any] | None = None, timeout: float = 60.0) -> dict[str, Any]:
    data = None
    headers = {"Accept": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {e.code} for {method} {url}: {detail}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"Cannot reach {url}: {e.reason}") from e


def healthcheck(base: str) -> None:
    payload = http_json("GET", f"{base}/health", timeout=5.0)
    status = payload.get("status")
    if status not in ("ok", "healthy", "UP"):
        # Agent returns {"status":"ok"}; accept also empty/unknown if HTTP 200
        if status is not None:
            raise RuntimeError(f"Unexpected health payload: {payload}")


def build_payload(run: dict[str, Any], page_url: str, personas: dict[str, Any]) -> dict[str, Any]:
    persona_key = run.get("personaKey")
    persona = personas.get(persona_key) if isinstance(persona_key, str) else None
    payload: dict[str, Any] = {
        "url": page_url,
        "task": run["task"],
    }
    if run.get("max_steps") is not None:
        payload["max_steps"] = int(run["max_steps"])
    if isinstance(persona, dict):
        payload["persona"] = persona
    return payload


def poll_job(base: str, job_id: str, poll_seconds: float) -> dict[str, Any]:
    url = f"{base}/run/{job_id}"
    while True:
        result = http_json("GET", url, timeout=30.0)
        status = result.get("status")
        print(f"  [{job_id}] status={status}", flush=True)
        if status in ("complete", "error", "cancelled", "failed"):
            return result
        time.sleep(poll_seconds)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Print payloads only")
    parser.add_argument("--run-id", action="append", dest="run_ids", help="Limit to run id(s)")
    parser.add_argument("--no-wait", action="store_true", help="Start jobs but do not poll")
    args = parser.parse_args(argv)

    dry = args.dry_run or (os.environ.get("EBM_JOURNEY_DRY_RUN", "").strip() in ("1", "true", "yes"))
    poll_seconds = float(os.environ.get("EBM_JOURNEY_POLL_SECONDS", "5"))

    urls = load_json(URLS_PATH)
    tasks = load_json(TASKS_PATH)
    page_url = resolve_url(urls, tasks["urlKey"], "EBM_PRODUKTKOMBINATIONEN_URL")
    agent_base = resolve_url(urls, tasks["agentBaseUrlKey"], "UX_JOURNEY_AGENT_URL")

    env_run_ids = (os.environ.get("EBM_JOURNEY_RUN_IDS") or "").strip()
    selected = set(args.run_ids or [])
    if env_run_ids:
        selected.update(x.strip() for x in env_run_ids.split(",") if x.strip())

    runs = tasks["runs"]
    if selected:
        runs = [r for r in runs if r["id"] in selected]
        missing = selected - {r["id"] for r in runs}
        if missing:
            raise SystemExit(f"Unknown run id(s): {sorted(missing)}")

    personas = tasks.get("personas") or {}
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Target URL: {page_url}")
    print(f"Agent base: {agent_base}")
    print(f"Runs: {[r['id'] for r in runs]}")

    if dry:
        for run in runs:
            payload = build_payload(run, page_url, personas)
            out = OUT_DIR / f"{run['id']}.payload.json"
            out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"Wrote {out}")
        print("Dry-run complete (no POST).")
        return 0

    try:
        healthcheck(agent_base)
    except RuntimeError as e:
        print(
            f"ERROR: UX Journey Agent not reachable at {agent_base}\n"
            f"  {e}\n"
            "Start Docker Desktop/OrbStack, then:\n"
            "  docker compose up -d ux-journey-agent\n"
            "Or set UX_JOURNEY_AGENT_URL to your deployed agent.",
            file=sys.stderr,
        )
        return 2

    job_map: dict[str, str] = {}
    # Sequential: agent processes one heavy browser job reliably at a time.
    for run in runs:
        payload = build_payload(run, page_url, personas)
        print(f"\n=== Starting {run['id']} ({run.get('block')}) ===", flush=True)
        resp = http_json("POST", f"{agent_base}/run", payload, timeout=30.0)
        job_id = resp.get("jobId")
        if not job_id:
            raise RuntimeError(f"No jobId in response: {resp}")
        job_map[run["id"]] = job_id
        (OUT_DIR / f"{run['id']}.job.json").write_text(
            json.dumps({"runId": run["id"], "jobId": job_id, "payload": payload}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(f"  jobId={job_id}", flush=True)

        if args.no_wait:
            continue

        result = poll_job(agent_base, job_id, poll_seconds)
        result_path = OUT_DIR / f"{run['id']}.result.json"
        result_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"  wrote {result_path} status={result.get('status')}", flush=True)

    summary_path = OUT_DIR / "summary.json"
    summary_path.write_text(
        json.dumps({"agentBase": agent_base, "pageUrl": page_url, "jobs": job_map}, indent=2),
        encoding="utf-8",
    )
    print(f"\nSummary: {summary_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
