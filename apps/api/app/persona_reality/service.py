from __future__ import annotations

import copy
import json
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from .schemas import SessionRequest

_FIXTURES_ROOT = Path(__file__).resolve().parents[2] / "fixtures" / "persona_reality"
_GOLDEN_DIR = _FIXTURES_ROOT / "golden"
_SCHEMA_PATH = _FIXTURES_ROOT / "scene_config.v1.schema.json"

# Phase 1 stub: in-memory session store (replaced by DB in Phase 2)
_sessions: dict[str, dict] = {}

_SUPPORTED_GOLDEN_KEYS: dict[tuple[str, str], str] = {
    ("klaus_dortmund", "de"): "klaus_dortmund_de.json",
}


class PersonaNotFoundError(Exception):
    def __init__(self, persona_id: str) -> None:
        self.persona_id = persona_id
        super().__init__(f"Persona not found: {persona_id}")


class LanguageNotAvailableError(Exception):
    def __init__(self, persona_id: str, language: str) -> None:
        self.persona_id = persona_id
        self.language = language
        super().__init__(f"No session fixture for {persona_id} ({language})")


def schema_path() -> Path:
    return _SCHEMA_PATH


def load_golden_config(persona_id: str, language: str) -> dict:
    filename = _SUPPORTED_GOLDEN_KEYS.get((persona_id, language))
    if not filename:
        if (persona_id, "de") in _SUPPORTED_GOLDEN_KEYS and language == "en":
            raise LanguageNotAvailableError(persona_id, language)
        raise PersonaNotFoundError(persona_id)

    path = _GOLDEN_DIR / filename
    if not path.is_file():
        raise FileNotFoundError(f"Golden fixture missing: {path}")

    return json.loads(path.read_text(encoding="utf-8"))


def compose_session_stub(request: SessionRequest) -> dict:
    """
    Phase 1: return golden scene_config with fresh session ids and timestamps.
    Phase 2+: full matcher, data layers, validation.
    """
    config = copy.deepcopy(load_golden_config(request.persona_id, request.language))

    scene_id = f"se_{uuid4().hex[:12]}"
    now = datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")

    config["meta"]["scene_id"] = scene_id
    config["meta"]["persona_id"] = request.persona_id
    config["meta"]["generated_at"] = now
    config["meta"]["language"] = request.language
    config["meta"]["client_id"] = request.client_id
    config["meta"]["schema_version"] = "1.0"

    if request.client_id:
        # Phase 1: minimal brand hint; full brand_layer in Phase 2
        config["brand_layer"] = config.get("brand_layer") or {
            "client_id": request.client_id,
            "logo_texture": f"https://cdn.msqdx.de/brands/{request.client_id}/logo.png",
            "color_primary": "#005F61",
            "color_secondary": "#FFFFFF",
            "props_swap": [],
        }

    report_id = scene_id
    config["report"] = {
        "qr_url": f"https://msqdx.de/pr/r/{report_id}",
        "report_id": report_id,
    }

    _sessions[scene_id] = config
    return config


def get_session(scene_id: str) -> dict | None:
    return _sessions.get(scene_id)


def list_persona_summaries() -> list[dict]:
    """Stub persona list for iPad selector (Phase 1)."""
    config = load_golden_config("klaus_dortmund", "de")
    persona = config["persona"]
    axes = persona["axes"]
    return [
        {
            "id": persona["id"],
            "display_name": persona["display_name"],
            "short_descriptor": f"{persona['occupation']} · {persona['location']}",
            "axes": axes,
        }
    ]


def validate_against_schema(config: dict) -> None:
    """Validate config against scene_config.v1.schema.json (Phase 1+)."""
    try:
        import jsonschema
    except ImportError as exc:
        raise RuntimeError("jsonschema is required for validation") from exc

    schema = json.loads(schema_path().read_text(encoding="utf-8"))
    jsonschema.validate(instance=config, schema=schema)
