"""First-class persona support for the agent.

CHECKION-fork patch (vs. upstream browser-use 0.12.6).

Upstream lets callers shape behaviour with `extend_system_message` (a free
string), which is fine for one-off instructions but loses every signal that
isn't naturally English prose. CHECKION runs the agent on persona records
that are *structured* — id, name, headline, profile (bio / values / interests
/ traits / pain-points / goals / communication style) — and we want the
behaviour to be *deterministically* derived from those fields.

This module exposes:

- ``PersonaProfile`` / ``PersonaContext`` — typed wrappers that accept either
  a Pydantic instance, a plain ``dict``, or ``None`` (for the disabled case).
- ``PersonaDimensions`` / ``PersonaPolicy`` — a coarse-grained behaviour
  policy *derived* from the persona text via deterministic keyword scoring.
  Six dimensions (risk_aversion, time_pressure, exploration,
  detail_orientation, trust_skepticism, accessibility_need) and a list of
  actionable navigation heuristics.
- ``derive_policy(persona)`` — pure function: persona → policy.
- ``render_system_prompt_block(persona)`` — pure function: persona → string
  block to feed into ``Agent(extend_system_message=...)``. The block is in
  English (the language the system prompt uses) but instructs the model to
  reason and output in German.

The agent's ``__init__`` (see ``agent.service.Agent``) accepts a ``persona``
parameter that, when set, transparently builds the prompt block via this
module and merges it with whatever ``extend_system_message`` the caller
already provided. Callers don't need to import this module directly unless
they want to inspect the derived policy (e.g. for telemetry / UI).

The behaviour is gated by ``CHECKION_AGENT_PERSONA_INSTRUCTIONS`` (env,
default ``1``). Set ``=0`` for strict upstream-equivalent behaviour (no
persona string injected — the caller is responsible for building one).
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Mapping

from pydantic import BaseModel, ConfigDict, Field

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Feature flag
# ---------------------------------------------------------------------------


def persona_instructions_enabled() -> bool:
	"""Toggle for the CHECKION persona-block injection.

	Default: ``1``. Set ``CHECKION_AGENT_PERSONA_INSTRUCTIONS=0`` to disable
	the automatic persona-block generation in ``Agent(persona=...)``.
	Useful when the caller wants to construct the system-prompt extension
	themselves and pass it via the upstream ``extend_system_message``.
	"""
	v = (os.environ.get('CHECKION_AGENT_PERSONA_INSTRUCTIONS') or '1').strip().lower()
	return v in ('1', 'true', 'yes', 'on')


# ---------------------------------------------------------------------------
# Typed persona payload
# ---------------------------------------------------------------------------


class PersonaProfile(BaseModel):
	"""Subset of profile fields that meaningfully shape navigation behaviour.

	All fields are optional — callers commonly only have a few of these
	populated. Keeping the model permissive (``extra='allow'``) means
	upstream consumers can extend the profile without a schema change.
	"""

	model_config = ConfigDict(extra='allow')

	bio: str | None = None
	location: str | None = None
	values: list[str] | str | None = None
	interests: list[str] | str | None = None
	traits: list[str] | str | None = None
	pain_points: list[str] | str | None = Field(default=None, alias='painPoints')
	goals: list[str] | str | None = None
	communication_style: list[str] | str | dict[str, Any] | None = Field(default=None, alias='communicationStyle')


class PersonaContext(BaseModel):
	"""Structured persona payload accepted by ``Agent(persona=...)``.

	Field aliases mirror the JSON shape used by CHECKION's persona records
	(camelCase) so a plain ``dict`` parsed from the API can be coerced
	without remapping. ``id`` / ``name`` / ``headline`` / ``system_prompt``
	are the headline metadata; ``profile`` carries the structured fields
	that drive the derived policy.

	**Phase 3 (DSL fields):** four optional fields let persona designers
	override the keyword-derived behaviour explicitly, instead of relying
	on prose-based scoring:

	- ``dimension_overrides`` — map any of the six dimension names
	  (``risk_aversion``, ``time_pressure``, ``exploration``,
	  ``detail_orientation``, ``trust_skepticism``, ``accessibility_need``)
	  to a value in ``[0, 1]``. Wins over the keyword score when both
	  produce a number for the same dimension. Useful when a persona's
	  prose doesn't match the German keyword catalogue but the designer
	  wants a clear behavioural slant.
	- ``dos`` / ``donts`` — explicit bullet lists rendered into the
	  ``BEHAVIOR_POLICY`` block as ``- ALWAYS: ...`` / ``- NEVER: ...``.
	  Same shape as the auto-derived heuristics so the model treats them
	  identically. Capped at 8 items each to keep the prompt cacheable.
	- ``extra_instructions`` — a free-form trailing block appended at the
	  bottom of the persona block. Use for one-off, persona-specific notes
	  (e.g. "this persona avoids any product over €500"). Cap: 1000 chars.
	"""

	model_config = ConfigDict(extra='allow', populate_by_name=True)

	id: str | None = None
	name: str | None = None
	headline: str | None = None
	system_prompt: str | None = Field(default=None, alias='systemPrompt')
	profile: PersonaProfile | None = None
	# Permissive type — `_apply_dimension_overrides` filters non-numeric /
	# unknown-key entries at runtime so a single bad value doesn't reject
	# the whole persona record at coercion time.
	dimension_overrides: dict[str, Any] | None = Field(default=None, alias='dimensionOverrides')
	dos: list[str] | None = None
	donts: list[str] | None = None
	extra_instructions: str | None = Field(default=None, alias='extraInstructions')

	@classmethod
	def coerce(cls, value: Any) -> PersonaContext | None:
		"""Best-effort coercion from a `dict | PersonaContext | None`.

		Returns ``None`` for empty / falsy inputs and for inputs that can't
		be coerced into a meaningful persona; callers can then skip the
		injection entirely. Logs (debug) when a dict had to be coerced so
		operators can spot accidental type drift in the calling code.
		"""
		if value is None:
			return None
		if isinstance(value, cls):
			return value
		if isinstance(value, Mapping):
			try:
				return cls.model_validate(value)
			except Exception as exc:  # pragma: no cover — defensive
				logger.debug('PersonaContext.coerce: validation failed (%r), passing as-is', exc)
				return None
		logger.debug('PersonaContext.coerce: ignoring unsupported type %s', type(value).__name__)
		return None


# ---------------------------------------------------------------------------
# Derived behaviour policy
# ---------------------------------------------------------------------------


class PersonaDimensions(BaseModel):
	"""Six navigation-relevant dimensions in [0, 1].

	The defaults (0.5) represent the neutral persona — same behaviour as the
	upstream agent without any persona context. Each dimension is mapped to
	one or more concrete heuristics in ``derive_policy``.
	"""

	risk_aversion: float = 0.5
	time_pressure: float = 0.5
	exploration: float = 0.5
	detail_orientation: float = 0.5
	trust_skepticism: float = 0.5
	accessibility_need: float = 0.5


class PersonaPolicy(BaseModel):
	"""The deterministic policy derived from a ``PersonaContext``.

	``dimensions`` are emitted in telemetry / debug surfaces so external
	systems can plot how a persona is being interpreted. ``heuristics`` are
	the human-readable bullet points that get merged into the system prompt.
	"""

	dimensions: PersonaDimensions
	heuristics: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Internal helpers — keyword scoring
# ---------------------------------------------------------------------------


def _flatten(value: Any) -> list[str]:
	"""Return all string-ish leaves of a value, lowercased and stripped."""
	out: list[str] = []
	if isinstance(value, str):
		s = value.strip()
		if s:
			out.append(s.lower())
	elif isinstance(value, (list, tuple, set)):
		for v in value:
			out.extend(_flatten(v))
	elif isinstance(value, Mapping):
		for v in value.values():
			out.extend(_flatten(v))
	elif value is None:
		pass
	else:
		s = str(value).strip()
		if s:
			out.append(s.lower())
	return out


def _text_blob_from_persona(persona: PersonaContext) -> str:
	"""Concatenate every persona field into a single lowercased text blob.

	Used as the input to the keyword-scoring heuristics. Keeping it as a
	single blob (instead of weighting fields differently) makes the policy
	derivation stable when persona records are partially populated.
	"""
	chunks: list[str] = []
	for v in (persona.name, persona.headline, persona.system_prompt):
		if isinstance(v, str) and v.strip():
			chunks.append(v.strip().lower())
	if persona.profile is not None:
		chunks.extend(_flatten(persona.profile.model_dump(by_alias=True)))
	return '\n'.join(chunks)


def _score_keywords(text: str, positives: list[str], negatives: list[str] | None = None) -> float:
	"""Squash a positives-minus-negatives count into [0, 1].

	The 0.12 step / ±4 saturation are tuned empirically — small enough that
	any *one* matching keyword pulls the dimension a quarter-step in that
	direction without immediately maxing out, large enough that a persona
	with several thematic markers reaches a clear extreme.
	"""
	if not text:
		return 0.5
	pos = sum(1 for w in positives if w in text)
	neg = sum(1 for w in (negatives or []) if w in text)
	raw = pos - neg
	if raw >= 4:
		return 1.0
	if raw <= -4:
		return 0.0
	return max(0.0, min(1.0, 0.5 + (raw * 0.12)))


# ---------------------------------------------------------------------------
# Pure functions (importable, testable)
# ---------------------------------------------------------------------------


_DIMENSION_NAMES: tuple[str, ...] = (
	'risk_aversion',
	'time_pressure',
	'exploration',
	'detail_orientation',
	'trust_skepticism',
	'accessibility_need',
)


def _apply_dimension_overrides(
	scored: dict[str, float],
	overrides: dict[str, float] | None,
) -> dict[str, float]:
	"""Merge explicit ``dimension_overrides`` over keyword-scored values.

	Override values are clamped to [0, 1] and rounded to 2 decimal places to
	stay consistent with the scored output. Unknown keys are ignored (logged
	at debug level) so a typo in a persona record doesn't silently break a
	run.
	"""
	if not overrides:
		return scored
	merged = dict(scored)
	for key, value in overrides.items():
		if key not in _DIMENSION_NAMES:
			logger.debug('PersonaContext.dimension_overrides: ignoring unknown key %r', key)
			continue
		try:
			fv = float(value)
		except (TypeError, ValueError):
			logger.debug(
				'PersonaContext.dimension_overrides: ignoring non-numeric value for %r: %r',
				key, value,
			)
			continue
		merged[key] = round(max(0.0, min(1.0, fv)), 2)
	return merged


def derive_policy(persona: PersonaContext | None) -> PersonaPolicy:
	"""Derive a ``PersonaPolicy`` from a ``PersonaContext`` (or neutral default).

	When ``persona`` is ``None`` returns the neutral policy (all dimensions
	at 0.5, no heuristics) — equivalent to running the agent without any
	persona context. The function is pure: same input → same output, no
	side effects, no env reads.

	**Phase 3:** if ``persona.dimension_overrides`` is set, those values
	replace the keyword-scored ones for the matching dimension names.
	Heuristics are still derived from the *final* (post-override)
	dimensions, so an override of ``risk_aversion=0.9`` produces the
	high-risk-aversion heuristics even if the prose was neutral.
	"""
	if persona is None:
		return PersonaPolicy(dimensions=PersonaDimensions(), heuristics=[])

	text = _text_blob_from_persona(persona)

	risk_aversion = _score_keywords(
		text,
		positives=[
			'vorsichtig', 'risk', 'risiko', 'sicher', 'sicherheit',
			'skept', 'misstrau', 'datenschutz', 'privacy', 'vermeidet',
			'genau', 'gründlich',
		],
		negatives=['mutig', 'experimentier', 'impuls', 'spontan', 'draufgänger'],
	)
	time_pressure = _score_keywords(
		text,
		positives=[
			'schnell', 'zeitdruck', 'effizient', 'kurz', 'sofort',
			'dringend', 'quick', 'fast',
		],
		negatives=['geduldig', 'in ruhe', 'ausführlich', 'genießen', 'entspannt', 'slow'],
	)
	exploration = _score_keywords(
		text,
		positives=[
			'neugierig', 'entdecken', 'explor', 'inspir', 'stöbern',
			'ausprobieren', 'varianten', 'vergleich',
		],
		negatives=['ziel', 'goal', 'fokuss', 'direkt', 'straight', 'nur das nötigste'],
	)
	detail_orientation = _score_keywords(
		text,
		positives=[
			'detail', 'zahlen', 'daten', 'spezifikation', 'belege',
			'fakten', 'gründlich', 'analyse', 'vergleich', 'kriterien',
		],
		negatives=['oberflächlich', 'gefühlt', 'intuition', 'kurz'],
	)
	trust_skepticism = _score_keywords(
		text,
		positives=[
			'skept', 'misstrau', 'nachweis', 'quelle', 'bewertungen',
			'reviews', 'garantie', 'agb', 'bedingungen', 'impressum',
		],
		negatives=['vertrau', 'markenloyal', 'loyal', 'fan'],
	)
	accessibility_need = _score_keywords(
		text,
		positives=[
			'barriere', 'accessib', 'screenreader', 'seh', 'hör',
			'motor', 'einfach', 'klar', 'groß', 'kontrast',
		],
		negatives=['egal', 'unwichtig'],
	)

	scored = {
		'risk_aversion': round(risk_aversion, 2),
		'time_pressure': round(time_pressure, 2),
		'exploration': round(exploration, 2),
		'detail_orientation': round(detail_orientation, 2),
		'trust_skepticism': round(trust_skepticism, 2),
		'accessibility_need': round(accessibility_need, 2),
	}
	merged = _apply_dimension_overrides(scored, persona.dimension_overrides)
	dims = PersonaDimensions(**merged)

	heuristics: list[str] = []

	if dims.risk_aversion >= 0.66:
		heuristics.append('Prefer official navigation (menu/footer) over ads or unknown external links.')
		heuristics.append('Avoid suspicious popups; dismiss cookie banners safely; do not sign up unless required.')
	elif dims.risk_aversion <= 0.34:
		heuristics.append('Willing to try alternative paths quickly if the first route is blocked.')

	if dims.time_pressure >= 0.66:
		heuristics.append('Optimize for speed: use site search, direct model pages, and shortest path to the answer.')
	elif dims.time_pressure <= 0.34:
		heuristics.append('Take time to scan the page; read labels carefully before clicking.')

	if dims.exploration >= 0.66:
		heuristics.append('Explore 2–3 candidate paths before committing; compare options.')
	elif dims.exploration <= 0.34:
		heuristics.append('Stay goal-driven: pick one most likely path and follow it end-to-end.')

	if dims.detail_orientation >= 0.66:
		heuristics.append('Prefer detailed sources (spec sheets, configurator, FAQs) over marketing pages.')
	elif dims.detail_orientation <= 0.34:
		heuristics.append('Prefer summaries; avoid deep dives unless necessary.')

	if dims.trust_skepticism >= 0.66:
		heuristics.append('Verify claims via official pages and cross-check key facts when possible.')

	if dims.accessibility_need >= 0.66:
		heuristics.append('Prefer simple flows, high-contrast pages, and avoid complex interactions when alternatives exist.')

	return PersonaPolicy(dimensions=dims, heuristics=heuristics[:12])


# ---------------------------------------------------------------------------
# System-prompt block rendering
# ---------------------------------------------------------------------------


# Bounded-length budgets keep the system prompt cacheable across requests
# (Anthropic's prompt cache works best on stable, repeated prefixes).
_MAX_SYSTEM_PROMPT_CHARS = 2000
_MAX_PROFILE_JSON_CHARS = 4000
_MAX_EXTRA_INSTRUCTIONS_CHARS = 1000
_MAX_DSL_LIST_ITEMS = 8


def _clean_bullet_list(items: list[str] | None, *, cap: int = _MAX_DSL_LIST_ITEMS) -> list[str]:
	"""Strip / dedupe / cap a list of persona-DSL bullet strings.

	Used for ``dos`` / ``donts`` / ``heuristics`` — same shape, same caps,
	consistent prompt rendering. Order is preserved.
	"""
	if not items:
		return []
	seen: set[str] = set()
	out: list[str] = []
	for raw in items:
		if not isinstance(raw, str):
			continue
		s = raw.strip()
		if not s or s in seen:
			continue
		seen.add(s)
		out.append(s)
		if len(out) >= cap:
			break
	return out


def render_system_prompt_block(persona: PersonaContext | None) -> str:
	"""Render the persona block that gets appended to the system prompt.

	Returns ``''`` for ``persona is None`` or the disabled-via-env case, so
	the caller can append it unconditionally without a guard. The output
	starts and ends with single newlines so it composes cleanly with
	``extend_system_message`` strings the caller may have already prepared.

	**Phase 3 layout:** the rendered block has up to four sections, in this
	stable order:

	1. ``PERSONA_CONTEXT:`` — id / name / headline / systemPrompt / profile
	2. ``PERSONA_BEHAVIOR_POLICY:`` — dimensions + navigation_heuristics
	3. ``PERSONA_DSL:`` — explicit dos / donts (only if at least one is set)
	4. ``PERSONA_EXTRA_INSTRUCTIONS:`` — free-form trailing block (only if set)

	The order is intentionally stable so the model has a predictable layout
	to attend to — and so Anthropic's prompt cache treats unchanged
	persona records as a stable prefix.
	"""
	if persona is None or not persona_instructions_enabled():
		return ''

	persona_id = (persona.id or '').strip()
	name = (persona.name or '').strip()
	headline = (persona.headline or '').strip()
	system_prompt = (persona.system_prompt or '').strip()
	prompt_part = system_prompt[:_MAX_SYSTEM_PROMPT_CHARS] if system_prompt else ''

	profile_json = ''
	if persona.profile is not None:
		try:
			profile_json = json.dumps(
				persona.profile.model_dump(by_alias=True, exclude_none=True),
				ensure_ascii=False,
			)[:_MAX_PROFILE_JSON_CHARS]
		except (TypeError, ValueError) as exc:  # pragma: no cover — defensive
			logger.debug('render_system_prompt_block: profile JSON dump failed (%r)', exc)
			profile_json = ''

	policy = derive_policy(persona)
	dims = policy.dimensions
	dim_line = ', '.join(
		[
			f'risk_aversion={dims.risk_aversion}',
			f'time_pressure={dims.time_pressure}',
			f'exploration={dims.exploration}',
			f'detail_orientation={dims.detail_orientation}',
			f'trust_skepticism={dims.trust_skepticism}',
			f'accessibility_need={dims.accessibility_need}',
		]
	)
	hs = _clean_bullet_list(policy.heuristics)
	dos = _clean_bullet_list(persona.dos)
	donts = _clean_bullet_list(persona.donts)
	extra = (persona.extra_instructions or '').strip()[:_MAX_EXTRA_INSTRUCTIONS_CHARS]

	parts: list[str | None] = [
		'PERSONA_CONTEXT:',
		f'- id: {persona_id}' if persona_id else None,
		f'- name: {name}' if name else None,
		f'- headline: {headline}' if headline else None,
		f'- systemPrompt: {prompt_part}' if prompt_part else None,
		f'- profile: {profile_json}' if profile_json else None,
		'',
		'PERSONA_BEHAVIOR_POLICY:',
		f'- dimensions: {dim_line}',
	]
	if hs:
		parts.append('- navigation_heuristics:')
		parts.extend([f'  - {h}' for h in hs])

	if dos or donts:
		parts.extend(['', 'PERSONA_DSL:'])
		if dos:
			parts.append('- dos:')
			parts.extend([f'  - ALWAYS: {d}' for d in dos])
		if donts:
			parts.append('- donts:')
			parts.extend([f'  - NEVER: {d}' for d in donts])

	if extra:
		parts.extend(['', 'PERSONA_EXTRA_INSTRUCTIONS:', extra])

	parts.extend(
		[
			'',
			'INSTRUCTION: Execute the task as if you were this persona. Base choices, attention, and actions on the persona context above.',
			'When choosing actions, explicitly let the policy influence your choices. In your thinking, mention which dimension(s) drove the decision (e.g., risk_aversion, time_pressure).',
		]
	)
	body = '\n'.join([p for p in parts if p is not None])
	return body.strip() + '\n'


# ---------------------------------------------------------------------------
# Reasoning language (Phase 3)
# ---------------------------------------------------------------------------

# Friendly name shown in the prompt for common ISO-639 codes / human names.
# Anything not in this map is used as-is (e.g. ``Agent(reasoning_language='French')``
# renders as ``Reason in French``).
_REASONING_LANGUAGE_LABELS: dict[str, str] = {
	'de': 'German',
	'de-DE': 'German',
	'deutsch': 'German',
	'german': 'German',
	'en': 'English',
	'en-US': 'English',
	'en-GB': 'English',
	'english': 'English',
	'fr': 'French',
	'french': 'French',
	'es': 'Spanish',
	'spanish': 'Spanish',
	'it': 'Italian',
	'italian': 'Italian',
	'pt': 'Portuguese',
	'portuguese': 'Portuguese',
	'nl': 'Dutch',
	'dutch': 'Dutch',
}


def render_reasoning_language_block(language: str | None) -> str:
	"""Render the system-prompt block that pins the model's reasoning language.

	Returns ``''`` for ``None`` / empty / unrecognised inputs so callers can
	append unconditionally. The block targets the AgentOutput reasoning
	fields (``thinking`` / ``evaluation_previous_goal`` / ``memory`` /
	``next_goal`` / ``done.text``) — i.e. anything the *user* of the agent
	will read — without forcing the model to translate UI labels or quoted
	page content (which would degrade element-detection accuracy).
	"""
	if not language:
		return ''
	key = language.strip()
	if not key:
		return ''
	label = _REASONING_LANGUAGE_LABELS.get(key.lower(), key)
	return (
		'REASONING_LANGUAGE:\n'
		f'- IMPORTANT: Phrase ALL of your reasoning fields (thinking, evaluation_previous_goal, '
		f'memory, next_goal, done.text) in {label}. Keep selectors, URLs, element labels, and '
		f'quoted page content in their original language.\n'
	)


# Combined with `from __future__ import annotations` Pydantic needs an explicit
# model_rebuild call before the first model_validate, otherwise it reports
# "PersonaContext is not fully defined" because the forward-reference for
# `PersonaProfile` hasn't been resolved yet.
PersonaContext.model_rebuild()
PersonaPolicy.model_rebuild()

