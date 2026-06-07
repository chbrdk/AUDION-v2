"""Persona JSON identity prompts: no DB/session imports (safe for light unit tests)."""
from __future__ import annotations

from typing import Any

from .persona_ai_locale import normalize_output_locale

# LLM instruction: must match PersonaProfile (proto) + extras the UI expects in profile JSON.
PERSONA_LLM_JSON_SCHEMA_INSTRUCTION = (
    "Return ONE JSON object with these keys: "
    "name (string, short display name), full_name (string|null), age (integer|null), "
    "gender (string|null, use English labels where applicable, e.g. female, male, non-binary, prefer not to say), "
    "location (string|null, city/region/country one line), "
    "media_affinity (integer 0-100|null, digital/news/media consumption intensity), "
    "interests (array of 4-10 concise interest tags), "
    "values (array of 4-10 concise value statements for this persona), "
    "headline (string), bio (string), job_title (string|null, contextual only), "
    "pain_points (array of strings or {label, evidence_count} objects), "
    "goals (array of strings or {label, priority} objects where priority MUST be an integer 1..n, not words like high/medium), "
    "traits (object: trait name -> number 0-1 or qualitative level), "
    "communication_style: { vocabulary (string array), sentence_structure (string), skepticism_level (number 1-5) }, "
    "confidence (number 0-1). "
    "Optionally: social_media_usage (string array), attention_span (string), color_palette (string array). "
    "Do not omit interests or values; infer plausible items from the research when not explicit. "
    "LANGUAGE (mandatory): All human-readable string values must be English — name, full_name, headline, bio, "
    "job_title, gender, location, interests, values, pain point labels, goal labels, trait names/keys as shown to users, "
    "communication_style.vocabulary and sentence_structure, attention_span, social_media_usage strings. "
    "Keep JSON keys in English as listed. Numeric fields stay numbers."
)

PERSONA_LLM_JSON_SCHEMA_INSTRUCTION_DE = (
    "Return ONE JSON object with these keys: "
    "name (string, short display name), full_name (string|null), age (integer|null), "
    'gender (string|null, use German labels where applicable, e.g. \"weiblich\", \"männlich\", \"divers\", \"keine Angabe\"), '
    "location (string|null, city/region/country one line), "
    "media_affinity (integer 0-100|null, digital/news/media consumption intensity), "
    "interests (array of 4-10 concise interest tags), "
    "values (array of 4-10 concise value statements for this persona), "
    "headline (string), bio (string), job_title (string|null, contextual only), "
    "pain_points (array of strings or {label, evidence_count} objects), "
    "goals (array of strings or {label, priority} objects where priority MUST be an integer 1..n, not words like high/medium), "
    "traits (object: trait name -> number 0-1 or qualitative level), "
    "communication_style: { vocabulary (string array), sentence_structure (string), skepticism_level (number 1-5) }, "
    "confidence (number 0-1). "
    "Optionally: social_media_usage (string array), attention_span (string), color_palette (string array). "
    "Do not omit interests or values; infer plausible items from the research when not explicit. "
    "LANGUAGE (mandatory): All human-readable string values must be German (Hochdeutsch) — name, full_name, headline, bio, "
    "job_title, gender, location, interests, values, pain point labels, goal labels, trait names/keys as shown to users, "
    "communication_style.vocabulary and sentence_structure, attention_span, social_media_usage strings. "
    "Keep JSON keys in English as listed. Numeric fields stay numbers."
)


def persona_generation_output_locale(output_locale: Any) -> str:
    """
    Profile JSON from PersonaGenerationService: None/empty → English (canonical EN profile).
    Differs from normalize_output_locale(None) → \"de\" used by suggest / Ai-Assist defaults.
    """
    if output_locale is None:
        return "en"
    s = str(output_locale).strip()
    if not s:
        return "en"
    return normalize_output_locale(s)


def persona_llm_schema_instruction(resolved_locale: str) -> str:
    return PERSONA_LLM_JSON_SCHEMA_INSTRUCTION_DE if resolved_locale == "de" else PERSONA_LLM_JSON_SCHEMA_INSTRUCTION


def system_prompt_persona_identity_openai(resolved_locale: str) -> str:
    if resolved_locale == "de":
        return (
            "Du bist ein Assistent für die Persona-Generierung.\n"
            "Die Ausgabe MUSS ein einzelnes gültiges JSON-Objekt sein.\n"
            "KEINE Markdown-Codeblöcke. Kein Kommentar außerhalb des JSON.\n"
            "Alle nutzerlesbaren String-Werte im JSON müssen auf Deutsch (Hochdeutsch) sein.\n"
            "Interessen, Werte, full_name, gender, location, age, media_affinity wie im Nutzer-Schema.\n"
            "Wenn im Nutzer-Prompt bereits vorhandene Personas aufgeführt sind: eindeutiger Anzeigename und unterscheidbare Demografie.\n"
            "Vermeide nicht-escapte doppelte Anführungszeichen in String-Werten."
        )
    return (
        "You are a helpful persona generation assistant.\n"
        "Output MUST be a single valid JSON object.\n"
        "Do NOT wrap JSON in markdown fences. Do NOT add any commentary.\n"
        "All human-readable string values in the JSON must be English.\n"
        "Include interests, values, full_name, gender, location, age, media_affinity as in the user schema.\n"
        "When existing personas are listed in the user message, pick a unique display name and distinct demographics.\n"
        "Avoid using unescaped double-quotes inside string values (e.g. don’t quote phrases like “...”)."
    )


def system_prompt_persona_identity_anthropic(resolved_locale: str) -> str:
    if resolved_locale == "de":
        return (
            "Du gibst nur ein einzelnes JSON-Objekt aus. Keine Markdown- oder Codefences. "
            "Kein Kommentar vor oder nach dem JSON. Escape doppelte Anführungszeichen in Strings. "
            "Alle nutzerlesbaren Strings im JSON auf Deutsch (Hochdeutsch). "
            "Das Objekt enthält interests (Array), values (Array), Demografie "
            "(full_name, gender, location, age, media_affinity 0-100) sowie headline, bio, traits, pain_points, goals, "
            "communication_style, confidence."
        )
    return (
        "You output a single JSON object only. Do not wrap it in markdown or code fences. "
        "Do not add commentary before or after the JSON. Escape any double quotes inside string values. "
        "All human-readable strings in the JSON must be English. "
        "The object must include interests (array), values (array), demographics "
        "(full_name, gender, location, age, media_affinity 0-100) plus headline, bio, traits, pain_points, goals, "
        "communication_style, confidence."
    )
