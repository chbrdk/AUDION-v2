"""Best-effort public URL → plain text for easy-setup project context (not full crawling)."""
from __future__ import annotations

import ipaddress
import re
from html.parser import HTMLParser
from urllib.parse import urlparse

import httpx
import structlog

from ..core.config import get_settings

logger = structlog.get_logger(__name__)


class _HTMLToText(HTMLParser):
    _SKIP_TAGS = frozenset(
        {"script", "style", "noscript", "template", "svg", "iframe", "head", "meta", "link"}
    )

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._chunks: list[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        t = tag.lower()
        if t in self._SKIP_TAGS:
            self._skip_depth += 1

    def handle_endtag(self, tag: str) -> None:
        t = tag.lower()
        if t in self._SKIP_TAGS and self._skip_depth > 0:
            self._skip_depth -= 1

    def handle_data(self, data: str) -> None:
        if self._skip_depth > 0:
            return
        text = data.strip()
        if text:
            self._chunks.append(text)

    def text(self) -> str:
        raw = " ".join(self._chunks)
        raw = re.sub(r"\s+", " ", raw).strip()
        return raw


def _host_blocked_for_ssrf(host: str) -> bool:
    h = (host or "").strip().lower()
    if not h:
        return True
    if h == "localhost" or h.endswith(".localhost"):
        return True
    if h in {"metadata.google.internal", "metadata", "169.254.169.254"}:
        return True
    try:
        ip = ipaddress.ip_address(h)
        return bool(
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
        )
    except ValueError:
        return False


def normalize_public_http_url(raw: str) -> tuple[str | None, str | None]:
    """
    Validate URL for server-side fetch. Returns (normalized_url, error_reason).
    """
    s = (raw or "").strip()
    if not s:
        return None, None
    parsed = urlparse(s)
    if parsed.scheme not in {"http", "https"}:
        return None, "Only http and https URLs are allowed."
    if not parsed.netloc:
        return None, "Invalid URL."
    host = parsed.hostname
    if not host:
        return None, "Invalid URL host."
    if _host_blocked_for_ssrf(host):
        return None, "URL host is not allowed."
    # Re-stringify without userinfo (no credentials in URL)
    if "@" in parsed.netloc and parsed.username is not None:
        return None, "URLs with credentials are not allowed."
    return s, None


def fetch_website_plain_text(url: str) -> tuple[str | None, str | None]:
    """
    GET url with size cap; return (plain_text_or_none, error_or_none).
    On recoverable failures, returns (None, short message) — caller may ignore.
    """
    settings = get_settings()
    timeout = httpx.Timeout(settings.easy_setup_url_fetch_timeout_seconds)
    max_bytes = settings.easy_setup_url_max_response_bytes
    max_chars = settings.easy_setup_url_max_text_chars

    headers = {
        "User-Agent": "AudionEasySetup/1.0 (+https://audion)",
        "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
    }
    encoding_guess = "utf-8"
    try:
        with httpx.Client(timeout=timeout, follow_redirects=True, headers=headers) as client:
            with client.stream("GET", url) as response:
                if response.status_code >= 400:
                    return None, f"HTTP {response.status_code}"
                encoding_guess = getattr(response, "encoding", None) or "utf-8"
                chunks: list[bytes] = []
                total = 0
                for part in response.iter_bytes():
                    if not part:
                        continue
                    chunks.append(part)
                    total += len(part)
                    if total >= max_bytes:
                        break
                raw_bytes = b"".join(chunks)
    except httpx.RequestError as exc:
        logger.warning("easy_setup.url_fetch_error", url=url, error=str(exc))
        return None, str(exc) or "Request failed"
    except Exception as exc:  # noqa: BLE001
        logger.warning("easy_setup.url_fetch_unexpected", url=url, error=str(exc))
        return None, str(exc) or "Unexpected error"

    text: str
    try:
        text = raw_bytes.decode(encoding_guess, errors="replace")
    except Exception:
        text = raw_bytes.decode("utf-8", errors="replace")

    parser = _HTMLToText()
    try:
        parser.feed(text)
        parser.close()
    except Exception:
        plain = re.sub(r"<[^>]+>", " ", text)
        plain = re.sub(r"\s+", " ", plain).strip()
    else:
        plain = parser.text()

    if len(plain) > max_chars:
        plain = plain[:max_chars].rstrip() + "\n…"
    if not plain:
        return None, "No extractable text from page"
    return plain, None
