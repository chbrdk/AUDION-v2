from __future__ import annotations

from typing import AsyncIterator

import httpx
from fastapi import APIRouter, Body, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse, Response, StreamingResponse

from ..core.config import get_settings
from ..models import User
from ..services.auth import get_current_user

router = APIRouter(prefix="/ux-journey-agent", tags=["ux-journey-agent"])


def _agent_base_url_or_503() -> tuple[str, float]:
    settings = get_settings()
    base = (settings.ux_journey_agent_url or "").strip().rstrip("/")
    if not base:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="UX Journey Agent is not configured (UX_JOURNEY_AGENT_URL).",
        )
    timeout = float(settings.ux_journey_agent_timeout_seconds or 30.0)
    return base, timeout


@router.post("/run")
async def start_run(
    body: dict = Body(...),
    current_user: User = Depends(get_current_user),
) -> JSONResponse:
    """Start a UX journey-agent run. Forwards to the agent service (POST /run)."""
    del current_user  # auth only
    base, timeout = _agent_base_url_or_503()
    url = f"{base}/run"
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            res = await client.post(url, json=body)
        content_type = res.headers.get("content-type", "application/json")
        if res.status_code >= 400:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"UX Journey Agent error ({res.status_code}).",
            )
        data = res.json()
        return JSONResponse(content=data, media_type=content_type)
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="UX Journey Agent request timed out.") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to reach UX Journey Agent service.") from exc


@router.get("/run/{job_id}")
async def get_run(
    job_id: str,
    current_user: User = Depends(get_current_user),
) -> JSONResponse:
    """Get status/result for a run. Forwards to the agent service (GET /run/{jobId})."""
    del current_user  # auth only
    base, timeout = _agent_base_url_or_503()
    url = f"{base}/run/{job_id}"
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            res = await client.get(url)
        if res.status_code == 404:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
        if res.status_code >= 400:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"UX Journey Agent error ({res.status_code}).")
        return JSONResponse(content=res.json(), media_type=res.headers.get("content-type", "application/json"))
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="UX Journey Agent request timed out.") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to reach UX Journey Agent service.") from exc


async def _stream_upstream(
    request: Request, upstream_url: str, *, timeout: float
) -> tuple[AsyncIterator[bytes], str, int, dict[str, str]]:
    client = httpx.AsyncClient(timeout=timeout, follow_redirects=True)
    # Pass through headers that streaming consumers (especially <video>) rely on.
    req_headers: dict[str, str] = {"Accept": request.headers.get("accept", "*/*")}
    range_header = request.headers.get("range")
    if range_header:
        req_headers["Range"] = range_header
    if_range = request.headers.get("if-range")
    if if_range:
        req_headers["If-Range"] = if_range

    upstream = await client.stream(
        "GET",
        upstream_url,
        headers=req_headers,
    ).__aenter__()

    async def _iter() -> AsyncIterator[bytes]:
        try:
            async for chunk in upstream.aiter_bytes():
                if chunk:
                    yield chunk
        finally:
            await upstream.__aexit__(None, None, None)
            await client.aclose()

    media_type = upstream.headers.get("content-type") or "application/octet-stream"
    passthrough_headers: dict[str, str] = {}
    for k in ("accept-ranges", "content-range", "content-length", "etag", "last-modified"):
        v = upstream.headers.get(k)
        if v:
            passthrough_headers[k] = v
    if upstream.status_code == 404:
        # E.g. job not running / no live frame.
        await upstream.__aexit__(None, None, None)
        await client.aclose()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    if upstream.status_code >= 400:
        await upstream.__aexit__(None, None, None)
        await client.aclose()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"UX Journey Agent error ({upstream.status_code}).")
    return _iter(), media_type, upstream.status_code, passthrough_headers


@router.get("/run/{job_id}/live/diag")
async def live_diag(
    job_id: str,
    current_user: User = Depends(get_current_user),
) -> JSONResponse:
    """Diagnostic JSON about live capture status (agent GET /run/{jobId}/live/diag)."""
    del current_user  # auth only
    base, timeout = _agent_base_url_or_503()
    upstream_url = f"{base}/run/{job_id}/live/diag"
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            res = await client.get(upstream_url)
        if res.status_code >= 400:
            return JSONResponse(
                status_code=res.status_code,
                content={"detail": f"UX Journey Agent diag returned {res.status_code}"},
            )
        return JSONResponse(content=res.json(), media_type=res.headers.get("content-type", "application/json"))
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="UX Journey Agent request timed out.") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to reach UX Journey Agent service.") from exc


@router.get("/run/{job_id}/live")
async def live_frame(
    job_id: str,
    current_user: User = Depends(get_current_user),
) -> Response:
    """Latest single JPEG frame while the job is running (agent GET /run/{jobId}/live)."""
    del current_user  # auth only
    base, timeout = _agent_base_url_or_503()
    upstream_url = f"{base}/run/{job_id}/live"
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            res = await client.get(upstream_url)
        if res.status_code == status.HTTP_404_NOT_FOUND:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No live frame")
        if res.status_code >= 400:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"UX Journey Agent error ({res.status_code}).",
            )
        media_type = res.headers.get("content-type") or "image/jpeg"
        return Response(content=res.content, media_type=media_type, headers={"Cache-Control": "no-store"})
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="UX Journey Agent request timed out.") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to reach UX Journey Agent service.") from exc


@router.get("/run/{job_id}/step/{step_no}/screenshot")
async def step_screenshot(
    job_id: str,
    step_no: int,
    current_user: User = Depends(get_current_user),
) -> Response:
    """Per-step viewport JPEG from the UX Journey Agent."""
    del current_user  # auth only
    base, timeout = _agent_base_url_or_503()
    upstream_url = f"{base}/run/{job_id}/step/{step_no}/screenshot"
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            res = await client.get(upstream_url)
        if res.status_code == status.HTTP_404_NOT_FOUND:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Screenshot not found")
        if res.status_code >= 400:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"UX Journey Agent error ({res.status_code}).",
            )
        media_type = res.headers.get("content-type") or "image/jpeg"
        return Response(content=res.content, media_type=media_type, headers={"Cache-Control": "no-store"})
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="UX Journey Agent request timed out.") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to reach UX Journey Agent service.") from exc


@router.get("/run/{job_id}/live/stream")
async def live_stream(
    job_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    """MJPEG stream passthrough (GET /run/{jobId}/live/stream)."""
    del current_user  # auth only
    base, timeout = _agent_base_url_or_503()
    upstream_url = f"{base}/run/{job_id}/live/stream"
    iterator, media_type, upstream_status, passthrough_headers = await _stream_upstream(request, upstream_url, timeout=timeout)
    headers = {"Cache-Control": "no-store", **passthrough_headers}
    return StreamingResponse(iterator, media_type=media_type, status_code=upstream_status, headers=headers)


@router.get("/run/{job_id}/video")
async def video(
    job_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    """Video passthrough (GET /run/{jobId}/video)."""
    del current_user  # auth only
    base, timeout = _agent_base_url_or_503()
    upstream_url = f"{base}/run/{job_id}/video"
    iterator, media_type, upstream_status, passthrough_headers = await _stream_upstream(request, upstream_url, timeout=timeout)
    headers = {"Cache-Control": "no-store", **passthrough_headers}
    return StreamingResponse(iterator, media_type=media_type, status_code=upstream_status, headers=headers)

