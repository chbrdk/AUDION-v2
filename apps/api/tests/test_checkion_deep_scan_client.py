from __future__ import annotations

import httpx

from app.services.checkion_deep_scan_client import (
    fetch_checkion_page_metadata_by_domain,
    fetch_checkion_page_metadata_for_research,
    hostname_for_checkion_domain,
    list_checkion_projects,
    normalize_checkion_base_url,
    normalize_url_match_key,
    slim_page_to_checkion_payload,
)


def test_normalize_checkion_base_url():
    assert normalize_checkion_base_url("http://checkion:3000/") == "http://checkion:3000"
    assert normalize_checkion_base_url(None) is None


def test_hostname_for_checkion_domain():
    assert hostname_for_checkion_domain("https://MSQdx.com/en/foo") == "msqdx.com"
    assert hostname_for_checkion_domain("msqdx.com") == "msqdx.com"


def test_normalize_url_match_key_trailing_slash():
    a = normalize_url_match_key("https://Msqdx.com/en/")
    b = normalize_url_match_key("https://msqdx.com/en")
    assert a == b == "msqdx.com/en"


def test_slim_page_to_checkion_payload():
    page = {
        "url": "https://msqdx.com/en",
        "score": 88,
        "ux": {"score": 70},
        "pageClassification": {"tagTiers": [{"tag": "Marketing", "tier": 2}]},
        "stats": {"errors": 1, "warnings": 2, "notices": 0},
    }
    out = slim_page_to_checkion_payload(page)
    assert out["score"] == 88
    assert out["uxScore"] == 70
    assert out["pageClassification"]["tagTiers"][0]["tag"] == "Marketing"
    assert out["stats"]["errors"] == 1


def test_fetch_checkion_page_metadata_by_domain_mock_transport():
    calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(str(request.url))
        u = str(request.url)
        if "/api/scan/domain/by-domain" in u:
            return httpx.Response(200, json={"success": True, "data": {"scanId": "abc-123", "domain": "msqdx.com"}})
        if "/api/scan/domain/abc-123/slim-pages" in u:
            return httpx.Response(
                200,
                json={
                    "success": True,
                    "data": [
                        {
                            "url": "https://msqdx.com/en/about",
                            "score": 90,
                            "pageClassification": {"tags": ["corp"]},
                        }
                    ],
                    "total": 1,
                },
            )
        return httpx.Response(404, json={"success": False})

    transport = httpx.MockTransport(handler)
    with httpx.Client(transport=transport) as client:
        m = fetch_checkion_page_metadata_by_domain(
            base_url="http://checkion",
            token="checkion_" + "a" * 64,
            domain="msqdx.com",
            http_client=client,
        )

    assert any("by-domain" in c for c in calls)
    assert any("slim-pages" in c for c in calls)
    key = normalize_url_match_key("https://msqdx.com/en/about")
    assert key in m
    assert m[key]["score"] == 90
    assert m[key]["pageClassification"]["tags"] == ["corp"]


def test_fetch_checkion_page_metadata_for_research_prefers_linked_project():
    calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(str(request.url))
        u = str(request.url)
        if "/api/projects/p1/domain-summary" in u:
            return httpx.Response(200, json={"success": True, "data": {"scanId": "scan-from-project"}})
        if "/api/scan/domain/scan-from-project/slim-pages" in u:
            return httpx.Response(
                200,
                json={
                    "success": True,
                    "data": [{"url": "https://msqdx.com/en", "score": 77}],
                    "total": 1,
                },
            )
        return httpx.Response(418, json={"success": False})

    transport = httpx.MockTransport(handler)
    with httpx.Client(transport=transport) as client:
        m = fetch_checkion_page_metadata_for_research(
            base_url="http://checkion",
            token="checkion_" + "c" * 64,
            seed_url="https://msqdx.com/en",
            checkion_project_id="p1",
            http_client=client,
        )

    assert any("domain-summary" in c for c in calls)
    assert any("scan-from-project" in c and "slim-pages" in c for c in calls)
    key = normalize_url_match_key("https://msqdx.com/en")
    assert m[key]["score"] == 77


def test_fetch_checkion_page_metadata_for_research_falls_back_to_by_domain():
    calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(str(request.url))
        u = str(request.url)
        if "/api/scan/domain/by-domain" in u:
            return httpx.Response(200, json={"success": True, "data": {"scanId": "dom-scan"}})
        if "/api/scan/domain/dom-scan/slim-pages" in u:
            return httpx.Response(
                200,
                json={
                    "success": True,
                    "data": [{"url": "https://ex.com/", "score": 55}],
                    "total": 1,
                },
            )
        return httpx.Response(404)

    transport = httpx.MockTransport(handler)
    with httpx.Client(transport=transport) as client:
        m = fetch_checkion_page_metadata_for_research(
            base_url="http://checkion",
            token="checkion_" + "d" * 64,
            seed_url="https://ex.com",
            checkion_project_id=None,
            http_client=client,
        )

    assert any("by-domain" in c for c in calls)
    key = normalize_url_match_key("https://ex.com/")
    assert m[key]["score"] == 55


def test_list_checkion_projects_mock():
    def handler(request: httpx.Request) -> httpx.Response:
        if str(request.url).endswith("/api/projects") or "/api/projects" in str(request.url):
            return httpx.Response(
                200,
                json={
                    "success": True,
                    "data": [
                        {"id": "a1", "name": "Alpha", "domain": "alpha.com"},
                        {"id": "b2", "name": "Beta", "domain": None},
                    ],
                },
            )
        return httpx.Response(404)

    transport = httpx.MockTransport(handler)
    with httpx.Client(transport=transport) as client:
        rows = list_checkion_projects(
            base_url="http://checkion",
            token="checkion_" + "e" * 64,
            http_client=client,
        )
    assert rows == [
        {"id": "a1", "name": "Alpha", "domain": "alpha.com"},
        {"id": "b2", "name": "Beta", "domain": None},
    ]


def test_fetch_returns_empty_when_by_domain_no_scan():
    def handler(request: httpx.Request) -> httpx.Response:
        if "by-domain" in str(request.url):
            return httpx.Response(200, json={"success": True, "data": None})
        return httpx.Response(404)

    transport = httpx.MockTransport(handler)
    with httpx.Client(transport=transport) as client:
        m = fetch_checkion_page_metadata_by_domain(
            base_url="http://checkion",
            token="checkion_" + "b" * 64,
            domain="example.com",
            http_client=client,
        )
    assert m == {}
