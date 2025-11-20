from __future__ import annotations

import datetime as dt
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

try:
    import yaml
except ImportError:  # pragma: no cover
    yaml = None

from pipelines.config import PATHS


def _get_from_record(record: Dict[str, Any], path: str) -> Any:
    cursor = record
    for part in path.split("."):
        if cursor is None:
            return None
        cursor = cursor.get(part)
    return cursor


def _set_nested(target: Dict[str, Any], dotted_key: str, value: Any) -> None:
    nodes = dotted_key.split(".")
    cursor = target
    for node in nodes[:-1]:
        cursor = cursor.setdefault(node, {})
    cursor[nodes[-1]] = value


def normalize_score(value: Any, source_range: List[float] | None = None) -> float:
    if value is None:
        return 0.0
    source_min, source_max = source_range or (0.0, 1.0)
    span = source_max - source_min or 1
    return max(0.0, min(1.0, (float(value) - source_min) / span))


def invert_score(value: Any, source_range: List[float] | None = None) -> float:
    return 1 - normalize_score(value, source_range)


def sentiment_to_score(value: str, mapping: Dict[str, float]) -> float:
    return mapping.get(value, 0.5)


BUILTIN_TRANSFORMS = {
    "normalize_score": normalize_score,
    "invert_score": invert_score,
    "sentiment_to_score": sentiment_to_score,
}


@dataclass
class MappingConfig:
    source: Dict[str, Any]
    defaults: Dict[str, Any]
    field_map: Dict[str, Any]
    transformers: Dict[str, Any]


class PersonaTransformJob:
    def __init__(self, mapping_path: Path):
        if yaml is None:
            raise RuntimeError("PyYAML ist erforderlich, um Mapping-Dateien zu laden.")
        self.mapping_path = mapping_path
        self.config = self._load_mapping(mapping_path)
        PATHS.processed_bucket.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _load_mapping(path: Path) -> MappingConfig:
        data = yaml.safe_load(path.read_text())
        return MappingConfig(
            source=data["source"],
            defaults=data.get("defaults", {}),
            field_map=data.get("field_map", {}),
            transformers=data.get("transformers", {}),
        )

    def transform_records(
        self,
        records: Iterable[Dict[str, Any]],
        batch_id: Optional[str] = None,
        *,
        write_output: bool = True,
    ) -> List[Dict[str, Any]]:
        batch = batch_id or dt.datetime.utcnow().strftime("%Y%m%d-%H%M%S")
        output_dir = PATHS.processed_bucket / self.config.source["id"] / batch
        output_dir.mkdir(parents=True, exist_ok=True)
        processed = [self._transform_single(record) for record in records]
        if write_output:
            out_file = output_dir / "personas.jsonl"
            with out_file.open("w") as fh:
                for row in processed:
                    fh.write(json.dumps(row) + "\n")
        return processed

    def _transform_single(self, record: Dict[str, Any]) -> Dict[str, Any]:
        result: Dict[str, Any] = {
            "source_id": self.config.source["id"],
            "created_at": dt.datetime.now(dt.timezone.utc).isoformat(),
            **self.config.defaults,
        }
        context = {
            "record": record,
            "source": self.config.source,
        }
        for target_field, spec in self.config.field_map.items():
            value = self._evaluate(spec, context)
            if value is not None:
                _set_nested(result, target_field, value)
        return result

    def _evaluate(self, spec: Any, context: Dict[str, Any]) -> Any:
        if isinstance(spec, dict):
            expr = spec.get("expr")
            transformer = spec.get("transformer")
        else:
            expr = spec
            transformer = None
        value = self._resolve_expression(expr, context) if isinstance(expr, str) else expr
        if transformer:
            params = self.config.transformers.get(transformer, {}).get("params", {})
            fn = BUILTIN_TRANSFORMS.get(transformer)
            if not fn:
                raise ValueError(f"Unknown transformer: {transformer}")
            value = fn(value, **params)
        return value

    def _resolve_expression(self, expr: str, context: Dict[str, Any]) -> Any:
        expr = expr.strip()
        if expr.startswith("$record."):
            return _get_from_record(context["record"], expr.replace("$record.", "", 1))
        if expr.startswith("source."):
            return _get_from_record(context["source"], expr.replace("source.", "", 1))
        if expr.startswith("'") and expr.endswith("'"):
            return expr.strip("'")
        if expr.startswith('"') and expr.endswith('"'):
            return expr.strip('"')
        if expr.startswith("concat(") and expr.endswith(")"):
            args = self._split_args(expr[len("concat(") : -1])
            values = [self._resolve_expression(arg, context) for arg in args]
            return "".join(str(v) for v in values)
        for transformer_name in BUILTIN_TRANSFORMS.keys():
            call_prefix = f"{transformer_name}("
            if expr.startswith(call_prefix) and expr.endswith(")"):
                inner = expr[len(call_prefix) : -1]
                inner_value = self._resolve_expression(inner, context)
                params = self.config.transformers.get(transformer_name, {}).get("params", {})
                return BUILTIN_TRANSFORMS[transformer_name](inner_value, **params)
        try:
            return float(expr)
        except ValueError:
            return expr

    @staticmethod
    def _split_args(payload: str) -> List[str]:
        args: List[str] = []
        current = []
        depth = 0
        in_quote = False
        quote_char = ""
        for char in payload:
            if char in ("'", '"'):
                if in_quote and char == quote_char:
                    in_quote = False
                elif not in_quote:
                    in_quote = True
                    quote_char = char
            if char == "(" and not in_quote:
                depth += 1
            elif char == ")" and not in_quote and depth:
                depth -= 1
            if char == "," and depth == 0 and not in_quote:
                args.append("".join(current).strip())
                current = []
            else:
                current.append(char)
        if current:
            args.append("".join(current).strip())
        return args


__all__ = [
    "PersonaTransformJob",
    "normalize_score",
    "invert_score",
    "sentiment_to_score",
]

