"""Convert UX-journey-agent runs into structured Customer Journeys.

The service consumes a browser walkthrough (steps + observations + scorecard)
and produces a :class:`JourneyDraft` that the existing
:meth:`JourneyGenerationService.save_journey_draft` can persist verbatim.

Two strategies are supported:

* ``deterministic`` — URL-path clustering, zero LLM calls, predictable.
* ``ai`` — sends a compact transcript to the ``journey.from_ux_run`` prompt
  template; falls back to ``deterministic`` on any failure so the conversion
  CTA always returns *something* the user can edit later.
"""

from __future__ import annotations

import json
from dataclasses import asdict
from typing import Any, Dict, Iterable, List, Tuple
from urllib.parse import urlparse

import structlog

from ..schemas import AiAssistRequest
from .ai_assist import AiAssistService, PromptTemplateRegistry
from .journey_generation import JourneyDraft
from .persona_ai_locale import finalize_ai_locale_context
from .ux_journey_agent_client import fetch_run_payload


logger = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


_EMOTION_ORDER = ("frustrated", "anxious", "neutral", "hopeful", "satisfied", "delighted")


def _trim(value: Any, limit: int = 280) -> str:
    s = str(value or "").strip()
    if len(s) <= limit:
        return s
    return s[: max(0, limit - 1)].rstrip() + "\u2026"


def _path_segment(target: str | None) -> str | None:
    """Pick the first non-trivial URL path segment, used as phase key."""
    if not target:
        return None
    try:
        parsed = urlparse(target if "://" in target else f"https://{target}")
    except Exception:
        return None
    path = (parsed.path or "/").strip("/")
    if not path:
        return parsed.netloc.split(":")[0] or None
    return path.split("/", 1)[0]


def _emotion_from_score(score: float | None) -> tuple[str, float]:
    """Map an aggregate persona-fit score (-5..+5) to (emotion, intensity 0..1)."""
    if score is None:
        return "neutral", 0.4
    try:
        s = float(score)
    except Exception:
        return "neutral", 0.4
    if s <= -3:
        return "frustrated", min(1.0, abs(s) / 5.0)
    if s <= -1:
        return "anxious", min(1.0, abs(s) / 5.0)
    if s < 1:
        return "neutral", 0.4
    if s < 3:
        return "hopeful", min(1.0, s / 5.0)
    if s < 4.5:
        return "satisfied", min(1.0, s / 5.0)
    return "delighted", min(1.0, s / 5.0)


def _domain_of(url: str | None) -> str | None:
    if not url:
        return None
    try:
        parsed = urlparse(url if "://" in url else f"https://{url}")
    except Exception:
        return None
    return parsed.netloc.split(":")[0] or None


# ---------------------------------------------------------------------------
# Deterministic mapping
# ---------------------------------------------------------------------------


def _split_steps_into_phases(steps: list[dict[str, Any]]) -> list[tuple[str, list[dict[str, Any]]]]:
    """Group consecutive steps that share the same first-path-segment into phases.

    Returns ``[(phase_key, steps_in_phase), ...]`` preserving step order.
    Fallback: a single phase when no URL info is available.
    """
    if not steps:
        return []
    buckets: list[tuple[str, list[dict[str, Any]]]] = []
    current_key: str | None = None
    current: list[dict[str, Any]] = []
    for step in steps:
        target = step.get("target") or step.get("url") or ""
        key = _path_segment(target) or "session"
        if key != current_key and current:
            buckets.append((current_key or "session", current))
            current = []
        current_key = key
        current.append(step)
    if current:
        buckets.append((current_key or "session", current))
    return buckets


def _phase_name_from_key(key: str) -> str:
    """Make a human-friendly phase name from a URL path segment."""
    if not key or key == "session":
        return "Walkthrough"
    cleaned = key.replace("-", " ").replace("_", " ").strip()
    if not cleaned:
        return "Walkthrough"
    return cleaned[:50].title()


def _persona_fit_for_steps(
    step_numbers: Iterable[int],
    scorecard: dict[str, Any] | None,
) -> float | None:
    """Average the persona_fit rating across the given step numbers.

    Uses ``scorecard.perStepRatings`` if present (LLM-rated -5..+5), else
    returns ``None`` so the deterministic mapper falls back to neutral.
    """
    if not isinstance(scorecard, dict):
        return None
    per_step = scorecard.get("perStepRatings")
    if not isinstance(per_step, list):
        return None
    matched: list[float] = []
    target = {int(n) for n in step_numbers if isinstance(n, int) or (isinstance(n, str) and n.isdigit())}
    for entry in per_step:
        if not isinstance(entry, dict):
            continue
        try:
            step_no = int(entry.get("step"))
        except Exception:
            continue
        if step_no not in target:
            continue
        ratings = entry.get("ratings")
        if not isinstance(ratings, dict):
            continue
        pf = ratings.get("persona_fit")
        try:
            if pf is not None:
                matched.append(float(pf))
        except Exception:
            continue
    if not matched:
        return None
    return sum(matched) / len(matched)


def build_deterministic_draft(
    *,
    task: str,
    site_url: str | None,
    persona_name: str | None,
    steps: list[dict[str, Any]],
    scorecard: dict[str, Any] | None,
    journey_type: str = "ux_audit",
    journey_name: str | None = None,
) -> JourneyDraft:
    """Pure-Python URL-path cluster (no LLM). Always returns a valid draft."""

    if not journey_name:
        if persona_name:
            journey_name = f"UX-Run: {persona_name} \u2192 {task or 'Walkthrough'}"
        else:
            journey_name = f"UX-Run: {task or 'Walkthrough'}"

    description_bits: list[str] = []
    if site_url:
        description_bits.append(f"Site: {site_url}")
    if scorecard and isinstance(scorecard.get("frictionScore"), (int, float)):
        description_bits.append(f"Friction: {scorecard['frictionScore']:.1f}/10")
    if scorecard and isinstance(scorecard.get("personaFitScore"), (int, float)):
        description_bits.append(f"Persona-Fit: {scorecard['personaFitScore']:.1f}/10")
    description = " | ".join(description_bits) or "Generated from a browser UX-walkthrough."

    buckets = _split_steps_into_phases(steps)
    if not buckets:
        return JourneyDraft(
            name=journey_name,
            description=description,
            journey_type=journey_type,
            phases=[],
        )

    domain = _domain_of(site_url) if site_url else None
    quotes = scorecard.get("quotes") if isinstance(scorecard, dict) else None
    if not isinstance(quotes, list):
        quotes = []

    phases: list[dict[str, Any]] = []
    for index, (key, group) in enumerate(buckets, start=1):
        step_numbers = [s.get("step") for s in group if isinstance(s.get("step"), int)]
        pf = _persona_fit_for_steps(step_numbers, scorecard)
        emotion, intensity = _emotion_from_score(pf)

        elements: list[dict[str, Any]] = []
        order = 0
        domains_in_phase: list[str] = []
        for step in group:
            order += 1
            label = _trim(step.get("action") or "action", 80)
            target = _trim(step.get("target") or "", 200)
            content = label if not target else f"{label}: {target}"
            elements.append(
                {
                    "element_type": "action",
                    "content": content,
                    "element_order": order,
                }
            )
            reasoning = _trim(step.get("reasoning") or "", 240)
            if reasoning:
                order += 1
                elements.append(
                    {
                        "element_type": "thought",
                        "content": reasoning,
                        "element_order": order,
                    }
                )
            for obs in step.get("observations") or []:
                if not isinstance(obs, dict):
                    continue
                note = _trim(obs.get("note") or "", 240)
                if not note:
                    continue
                try:
                    polarity = float(obs.get("polarity") or 0)
                except Exception:
                    polarity = 0.0
                element_type = "pain_point" if polarity < 0 else "opportunity" if polarity > 0 else "thought"
                order += 1
                elements.append(
                    {
                        "element_type": element_type,
                        "content": note,
                        "element_order": order,
                    }
                )
            step_domain = _domain_of(step.get("target"))
            if step_domain and step_domain not in domains_in_phase:
                domains_in_phase.append(step_domain)

        # Distribute quotes to the first phase that "owns" their step number.
        for q in list(quotes):
            if not isinstance(q, dict):
                continue
            try:
                step_no = int(q.get("step")) if q.get("step") is not None else None
            except Exception:
                step_no = None
            if step_no is not None and step_no not in (s.get("step") for s in group):
                continue
            txt = _trim(q.get("text") or "", 280)
            if not txt:
                continue
            order += 1
            elements.append(
                {
                    "element_type": "quote",
                    "content": txt,
                    "element_order": order,
                }
            )

        phase_name = _phase_name_from_key(key)
        phase = {
            "name": phase_name,
            "description": f"Steps {step_numbers[0] if step_numbers else '-'}\u2013{step_numbers[-1] if step_numbers else '-'} of the browser walkthrough.",
            "phase_order": index,
            "expected_duration_min": max(1, len(group)),
            "expected_duration_max": max(2, len(group) * 2),
            "duration_unit": "minutes",
            "expected_emotion": emotion,
            "emotion_intensity": round(intensity, 2),
            "elements": elements,
        }
        if domains_in_phase or domain:
            phase["url_pattern"] = {
                "domains": sorted(set(filter(None, domains_in_phase + ([domain] if domain else [])))),
                "paths": [key] if key and key != "session" else [],
            }
        phases.append(phase)

    return JourneyDraft(
        name=journey_name,
        description=description,
        journey_type=journey_type,
        phases=phases,
    )


# ---------------------------------------------------------------------------
# AI mapping
# ---------------------------------------------------------------------------


def _build_step_brief(steps: list[dict[str, Any]], cap: int = 40) -> str:
    if not steps:
        return "(no steps)"
    lines: list[str] = []
    for st in steps[:cap]:
        if not isinstance(st, dict):
            continue
        step_no = st.get("step", "?")
        action = _trim(st.get("action") or "action", 60)
        target = _trim(st.get("target") or "", 160)
        reasoning = _trim(st.get("reasoning") or "", 200)
        line = f"#{step_no} {action}"
        if target:
            line += f" -> {target}"
        if reasoning:
            line += f" | thought: {reasoning}"
        lines.append(line)
    if len(steps) > cap:
        lines.append(f"... ({len(steps) - cap} more steps omitted) ...")
    return "\n".join(lines)


def _build_observations_brief(steps: list[dict[str, Any]], cap: int = 40) -> str:
    rows: list[str] = []
    for st in steps:
        if not isinstance(st, dict):
            continue
        obs_list = st.get("observations") or []
        if not isinstance(obs_list, list):
            continue
        for obs in obs_list:
            if not isinstance(obs, dict):
                continue
            note = _trim(obs.get("note") or "", 200)
            if not note:
                continue
            rows.append(
                f"step#{st.get('step', '?')} category={obs.get('category')} "
                f"polarity={obs.get('polarity')} severity={obs.get('severity')}: {note}"
            )
            if len(rows) >= cap:
                break
        if len(rows) >= cap:
            break
    return "\n".join(rows) or "(no validated observations)"


def _build_scorecard_summary(scorecard: dict[str, Any] | None) -> str:
    if not isinstance(scorecard, dict):
        return "(no scorecard)"
    chunks: list[str] = []
    for key in ("frictionScore", "personaFitScore"):
        val = scorecard.get(key)
        if isinstance(val, (int, float)):
            chunks.append(f"{key}={val:.2f}")
    cov = scorecard.get("coverage")
    if isinstance(cov, dict):
        chunks.append(f"goalReached={cov.get('goalReached')} gap={_trim(cov.get('gap') or '', 120)}")
    per_cat = scorecard.get("perCategory") or {}
    if isinstance(per_cat, dict):
        cat_bits = []
        for cat, payload in per_cat.items():
            if isinstance(payload, dict):
                score = payload.get("score")
                if isinstance(score, (int, float)):
                    cat_bits.append(f"{cat}={score:.2f}")
        if cat_bits:
            chunks.append("perCategory: " + ", ".join(cat_bits))
    strengths = scorecard.get("strengths") or []
    weaknesses = scorecard.get("weaknesses") or []
    if isinstance(strengths, list) and strengths:
        chunks.append("strengths: " + "; ".join(_trim(s, 80) for s in strengths[:3] if isinstance(s, str)))
    if isinstance(weaknesses, list) and weaknesses:
        chunks.append("weaknesses: " + "; ".join(_trim(s, 80) for s in weaknesses[:3] if isinstance(s, str)))
    return " | ".join(chunks) or "(scorecard empty)"


def _build_persona_summary(persona: dict[str, Any] | None) -> str:
    if not isinstance(persona, dict):
        return "(persona unknown)"
    bits: list[str] = []
    for key in ("name", "segment", "headline"):
        val = persona.get(key)
        if isinstance(val, str) and val.strip():
            bits.append(f"{key}={val.strip()}")
    profile = persona.get("profile")
    if isinstance(profile, dict):
        goals = profile.get("goals")
        if isinstance(goals, list) and goals:
            sample = []
            for g in goals[:3]:
                if isinstance(g, dict) and g.get("label"):
                    sample.append(str(g.get("label")))
                elif isinstance(g, str):
                    sample.append(g)
            if sample:
                bits.append("goals=" + "; ".join(sample))
    return ", ".join(bits) or "(persona without metadata)"


def _parse_ai_draft(raw_output: str, *, journey_type: str, fallback_name: str) -> JourneyDraft | None:
    if not raw_output:
        return None
    start = raw_output.find("{")
    end = raw_output.rfind("}") + 1
    if start < 0 or end <= start:
        return None
    try:
        data = json.loads(raw_output[start:end])
    except Exception:
        return None
    if not isinstance(data, dict):
        return None
    phases = data.get("phases")
    if not isinstance(phases, list) or not phases:
        return None
    return JourneyDraft(
        name=str(data.get("name") or fallback_name),
        description=str(data.get("description") or ""),
        journey_type=journey_type,
        phases=phases,
    )


class UxRunToJourneyService:
    """Coordinator that picks a strategy and returns a JourneyDraft."""

    def __init__(self, ai_assist: AiAssistService | None = None) -> None:
        self.ai_assist = ai_assist or AiAssistService(registry=PromptTemplateRegistry())

    async def fetch_run_payload(self, job_id: str) -> dict[str, Any]:
        """Proxy to the agent's GET /run/{jobId} via shared client."""
        return await fetch_run_payload(job_id)

    def build_deterministic(
        self,
        *,
        task: str,
        site_url: str | None,
        persona_name: str | None,
        steps: list[dict[str, Any]],
        scorecard: dict[str, Any] | None,
        journey_type: str = "ux_audit",
        journey_name: str | None = None,
    ) -> JourneyDraft:
        return build_deterministic_draft(
            task=task,
            site_url=site_url,
            persona_name=persona_name,
            steps=steps,
            scorecard=scorecard,
            journey_type=journey_type,
            journey_name=journey_name,
        )

    async def build_ai(
        self,
        *,
        task: str,
        site_url: str | None,
        persona: dict[str, Any] | None,
        steps: list[dict[str, Any]],
        scorecard: dict[str, Any] | None,
        journey_type: str = "ux_audit",
        journey_name: str | None = None,
        locale: str | None = None,
        retrieval_usage_user_id: str | None = None,
    ) -> JourneyDraft | None:
        """Call ``journey.from_ux_run`` template. Returns None on failure."""
        fallback_name = journey_name or f"UX-Run: {task or 'Walkthrough'}"
        raw_ctx: Dict[str, Any] = {
            "persona_summary": _build_persona_summary(persona),
            "task": _trim(task or "(no task)", 320),
            "site_url": _trim(site_url or "", 200),
            "scorecard_summary": _build_scorecard_summary(scorecard),
            "steps_brief": _build_step_brief(steps),
            "observations_brief": _build_observations_brief(steps),
            "journey_type": journey_type,
        }
        if locale and locale.strip():
            raw_ctx["output_locale"] = locale.strip()
        context = finalize_ai_locale_context(raw_ctx)
        try:
            request = AiAssistRequest(template_id="journey.from_ux_run", context=context)
            response = await self.ai_assist.generate(
                request,
                retrieval_usage_user_id=retrieval_usage_user_id,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("ux_run_to_journey.ai.failed", error=str(exc))
            return None
        draft = _parse_ai_draft(response.raw_output, journey_type=journey_type, fallback_name=fallback_name)
        if draft is None:
            logger.warning(
                "ux_run_to_journey.ai.invalid_json",
                preview=str(getattr(response, "raw_output", ""))[:240],
            )
        return draft

    async def convert(
        self,
        *,
        mode: str,
        task: str,
        site_url: str | None,
        persona: dict[str, Any] | None,
        steps: list[dict[str, Any]],
        scorecard: dict[str, Any] | None,
        journey_type: str = "ux_audit",
        journey_name: str | None = None,
        locale: str | None = None,
        retrieval_usage_user_id: str | None = None,
    ) -> Tuple[JourneyDraft, str, bool]:
        """Return (draft, mode_used, fallback_used).

        AI mode falls back to deterministic on any error / empty result.
        Deterministic mode is the source of truth for empty AI responses.
        """
        persona_name = None
        if isinstance(persona, dict):
            persona_name = (persona.get("name") or "").strip() or None
        normalized = (mode or "ai").strip().lower()
        if normalized == "ai":
            ai_draft = await self.build_ai(
                task=task,
                site_url=site_url,
                persona=persona,
                steps=steps,
                scorecard=scorecard,
                journey_type=journey_type,
                journey_name=journey_name,
                locale=locale,
                retrieval_usage_user_id=retrieval_usage_user_id,
            )
            if ai_draft is not None and ai_draft.phases:
                return ai_draft, "ai", False
            deterministic = self.build_deterministic(
                task=task,
                site_url=site_url,
                persona_name=persona_name,
                steps=steps,
                scorecard=scorecard,
                journey_type=journey_type,
                journey_name=journey_name,
            )
            return deterministic, "deterministic", True
        # explicit deterministic
        deterministic = self.build_deterministic(
            task=task,
            site_url=site_url,
            persona_name=persona_name,
            steps=steps,
            scorecard=scorecard,
            journey_type=journey_type,
            journey_name=journey_name,
        )
        return deterministic, "deterministic", False


__all__ = [
    "UxRunToJourneyService",
    "build_deterministic_draft",
]
