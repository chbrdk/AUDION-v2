"""Limited internal crawl + HTML→text extraction for Project AI Research.

V1 goals:
- Stay on the same host (or subdomains) as the seed URL.
- Cap depth/pages/bytes to keep the job bounded.
- Reuse SSRF guard + HTML→text from easy_setup_url.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Iterable
from urllib.parse import urljoin, urldefrag, urlparse

import httpx
import structlog
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..models import ProjectResearchRun, ProjectResearchSource
from .easy_setup_url import _HTMLToText, normalize_public_http_url

logger = structlog.get_logger(__name__)
settings = get_settings()


@dataclass(frozen=True)
class CrawlLimits:
    max_pages: int = 20
    max_depth: int = 2
    per_page_max_bytes: int = 1_500_000
    per_page_max_chars: int = 120_000
    request_timeout_seconds: float = 20.0


_HREF_RE = re.compile(r"""href\s*=\s*["']([^"'#]+)["']""", re.IGNORECASE)


def _same_site(url: str, seed_host: str) -> bool:
    """Allow same host or subdomain of seed host."""
    try:
        host = urlparse(url).hostname or ""
    except Exception:
        return False
    host = host.lower().strip(".")
    seed = (seed_host or "").lower().strip(".")
    return host == seed or host.endswith(f".{seed}")


def _normalize_url(u: str) -> str | None:
    u = (u or "").strip()
    if not u:
        return None
    u, _ = urldefrag(u)  # remove fragments
    # strip trailing slash duplicates
    if u.endswith("/") and len(u) > 8:
        u = u.rstrip("/")
    return u


def _extract_links(html: str) -> Iterable[str]:
    for m in _HREF_RE.finditer(html or ""):
        href = (m.group(1) or "").strip()
        if not href:
            continue
        if href.startswith("mailto:") or href.startswith("tel:"):
            continue
        yield href


def _fetch_html(url: str, *, limits: CrawlLimits) -> tuple[str | None, str | None, str | None]:
    """Return (html, content_type, error)."""
    headers = {
        "User-Agent": "AudionProjectResearch/1.0 (+https://audion)",
        "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
    }
    timeout = httpx.Timeout(limits.request_timeout_seconds)
    try:
        with httpx.Client(timeout=timeout, follow_redirects=True, headers=headers) as client:
            with client.stream("GET", url) as response:
                if response.status_code >= 400:
                    return None, None, f"HTTP {response.status_code}"
                content_type = (response.headers.get("content-type") or "").split(";")[0].strip().lower()
                if content_type and "html" not in content_type:
                    return None, content_type, "non_html"
                chunks: list[bytes] = []
                total = 0
                for part in response.iter_bytes():
                    if not part:
                        continue
                    chunks.append(part)
                    total += len(part)
                    if total >= limits.per_page_max_bytes:
                        break
                raw = b"".join(chunks)
                enc = getattr(response, "encoding", None) or "utf-8"
                html = raw.decode(enc, errors="replace")
                if len(html) > limits.per_page_max_chars:
                    html = html[: limits.per_page_max_chars]
                return html, content_type or "text/html", None
    except httpx.RequestError as exc:
        return None, None, str(exc) or "request_failed"
    except Exception as exc:  # noqa: BLE001
        return None, None, str(exc) or "unexpected_error"


def crawl_project_website(
    session: Session,
    *,
    run: ProjectResearchRun,
    seed_url: str,
    limits: CrawlLimits | None = None,
) -> list[ProjectResearchSource]:
    """Crawl within site and persist sources linked to `run`."""
    limits = limits or CrawlLimits()
    normalized_seed, err = normalize_public_http_url(seed_url)
    if err or not normalized_seed:
        raise ValueError(err or "Invalid seed URL")

    seed_host = urlparse(normalized_seed).hostname or ""
    if not seed_host:
        raise ValueError("Invalid seed host")

    visited: set[str] = set()
    queue: list[tuple[str, int]] = [(normalized_seed, 0)]
    sources: list[ProjectResearchSource] = []

    while queue and len(sources) < limits.max_pages:
        url, depth = queue.pop(0)
        url = _normalize_url(url) or ""
        if not url or url in visited:
            continue
        visited.add(url)

        if not _same_site(url, seed_host):
            continue

        # SSRF guard again after joins/redirects.
        normalized, url_err = normalize_public_http_url(url)
        if url_err or not normalized:
            continue

        html, content_type, fetch_err = _fetch_html(normalized, limits=limits)
        if fetch_err or not html:
            logger.info("project_research.crawl.skip", url=normalized, error=fetch_err)
            continue

        parser = _HTMLToText()
        try:
            parser.feed(html)
            parser.close()
            text = parser.text()
        except Exception:  # noqa: BLE001
            text = re.sub(r"<[^>]+>", " ", html)
            text = re.sub(r"\s+", " ", text).strip()

        if not text.strip():
            continue

        content_hash = hashlib.sha256(text.encode("utf-8", errors="ignore")).hexdigest()
        excerpt = text[:2000].rstrip()
        src = ProjectResearchSource(
            run_id=run.id,
            url=normalized,
            title=None,
            content_type=content_type,
            fetched_at=datetime.utcnow(),
            content_hash=content_hash,
            text_excerpt=excerpt,
            raw_text=text,
            meta={"depth": depth},
        )
        session.add(src)
        sources.append(src)

        if depth >= limits.max_depth:
            continue

        base = normalized
        for href in _extract_links(html):
            abs_url = urljoin(base + "/", href)
            abs_url = _normalize_url(abs_url) or ""
            if not abs_url:
                continue
            if abs_url in visited:
                continue
            if not _same_site(abs_url, seed_host):
                continue
            queue.append((abs_url, depth + 1))

    session.commit()
    for s in sources:
        session.refresh(s)
    return sources

