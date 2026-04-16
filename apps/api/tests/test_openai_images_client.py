from __future__ import annotations

import base64
import json
import os

import httpx
import pytest

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("AUTH_JWT_SECRET", "test-jwt-secret-openai-images")
os.environ.setdefault("OPENAI_API_KEY", "sk-test-openai-images")


def test_gpt_image_payload_omits_response_format(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("time.sleep", lambda *_args, **_kwargs: None)

    from app.core.config import get_settings
    from app.services.openai_images_client import OpenAIImagesClient

    get_settings.cache_clear()

    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/v1/images/generations"
        body = json.loads(request.content.decode("utf-8"))
        captured["body"] = body
        b64 = base64.b64encode(b"fake-png").decode("ascii")
        return httpx.Response(200, json={"data": [{"b64_json": b64}]})

    transport = httpx.MockTransport(handler)
    client = OpenAIImagesClient(transport=transport)
    out = client.generate_png(prompt="hello", model="gpt-image-1-mini")

    assert out.png_bytes == b"fake-png"
    body = captured["body"]
    assert isinstance(body, dict)
    assert "response_format" not in body
    assert body.get("output_format") == "png"
    assert body.get("moderation") == "low"


def test_dalle_payload_includes_response_format(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("time.sleep", lambda *_args, **_kwargs: None)

    from app.core.config import get_settings
    from app.services.openai_images_client import OpenAIImagesClient

    get_settings.cache_clear()

    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content.decode("utf-8"))
        captured["body"] = body
        b64 = base64.b64encode(b"x").decode("ascii")
        return httpx.Response(200, json={"data": [{"b64_json": b64}]})

    transport = httpx.MockTransport(handler)
    client = OpenAIImagesClient(transport=transport)
    client.generate_png(prompt="hello", model="dall-e-3")

    body = captured["body"]
    assert isinstance(body, dict)
    assert body.get("response_format") == "b64_json"


def test_retries_transient_status(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("time.sleep", lambda *_args, **_kwargs: None)

    from app.core.config import get_settings
    from app.services.openai_images_client import OpenAIImagesClient

    get_settings.cache_clear()

    attempts = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        attempts["n"] += 1
        if attempts["n"] == 1:
            return httpx.Response(429, json={"error": "rate_limited"})
        b64 = base64.b64encode(b"ok").decode("ascii")
        return httpx.Response(200, json={"data": [{"b64_json": b64}]})

    transport = httpx.MockTransport(handler)
    client = OpenAIImagesClient(transport=transport)
    out = client.generate_png(prompt="hello", model="gpt-image-1-mini")
    assert out.png_bytes == b"ok"
    assert attempts["n"] == 2


def test_non_retryable_http_error_is_runtimeerror(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("time.sleep", lambda *_args, **_kwargs: None)

    from app.core.config import get_settings
    from app.services.openai_images_client import OpenAIImagesClient

    get_settings.cache_clear()

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(400, json={"error": {"message": "bad request"}})

    transport = httpx.MockTransport(handler)
    client = OpenAIImagesClient(transport=transport)
    with pytest.raises(RuntimeError) as excinfo:
        client.generate_png(prompt="hello", model="gpt-image-1-mini")
    assert "openai_images_http_400" in str(excinfo.value)
