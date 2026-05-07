"""
Tool Execution Handler for Knowledge + Action Tools.

Executes Anthropic-style tool calls and returns results in the expected format.
"""

from __future__ import annotations

import asyncio
import time
import uuid
from typing import Any, Callable, Dict, List, Optional
from uuid import UUID

import httpx
import structlog

from sqlalchemy import select

from ..agents import tool_decisions
from ..agents.events import (
    ToolCompletedEvent,
    ToolProgressEvent,
    ToolProposedEvent,
    ToolStartedEvent,
)
from ..agents.retrieval import RetrievalAgent
from ..core.config import get_settings
from ..db import get_session
from ..models import DocumentChunk
from ..services.usage_report import report_retrieval_query_usage

logger = structlog.get_logger(__name__)
settings = get_settings()


class ToolExecutor:
    """Executes tool calls for the persona chat (knowledge + action tools)."""

    def __init__(self):
        self.retrieval_agent = RetrievalAgent()

    async def execute_tool(
        self,
        tool_name: str,
        arguments: Dict[str, Any],
        persona_segment: str | None = None,
        usage_user_id: str | None = None,
        send_event: Callable[[Any], None] | None = None,
        persona_context: Dict[str, Any] | None = None,
    ) -> Dict[str, Any]:
        """
        Execute a tool call and return results.

        Args:
            tool_name: Name of the tool to execute
            arguments: Tool arguments as a dictionary
            persona_segment: Optional persona segment for filtering
            usage_user_id: PLEXON/internal user id for usage tracking
            send_event: Optional callback for emitting lifecycle events (used by
                long-running tools like inspect_website to stream progress).
            persona_context: Snapshot of the active persona (id, name, headline,
                profile, systemPrompt) — forwarded to the ux-journey-agent.

        Returns:
            Dictionary with tool execution results
        """
        logger.info("tool_executor.execute", tool_name=tool_name, arguments_keys=list(arguments.keys()))

        if tool_name == "search_knowledge":
            return await self._search_knowledge(arguments, persona_segment, usage_user_id)
        elif tool_name == "get_target_group_knowledge":
            return await self._get_target_group_knowledge(arguments, usage_user_id)
        elif tool_name == "get_document_content":
            return await self._get_document_content(arguments)
        elif tool_name == "inspect_website":
            return await self._inspect_website(arguments, persona_context, send_event)
        else:
            logger.warning("tool_executor.unknown_tool", tool_name=tool_name)
            return {
                "error": f"Unknown tool: {tool_name}",
                "results": []
            }
    
    async def _search_knowledge(
        self,
        arguments: Dict[str, Any],
        persona_segment: str | None = None,
        usage_user_id: str | None = None,
    ) -> Dict[str, Any]:
        """Execute search_knowledge tool."""
        query = arguments.get("query", "")
        limit = min(arguments.get("limit", 5), 20)
        segment = arguments.get("persona_segment") or persona_segment
        
        if not query:
            return {
                "error": "Query is required",
                "results": [],
                "count": 0
            }
        
        try:
            # Use RetrievalAgent to search Qdrant
            _, hits = self.retrieval_agent.run(query=query, persona_segment=segment)
            
            results = []
            for hit in hits[:limit]:
                if not hit.payload:
                    continue
                
                # Extract score from hit (handle different Qdrant response formats)
                score = 0.0
                if hasattr(hit, "score"):
                    score = float(hit.score)
                elif isinstance(hit, dict) and "score" in hit:
                    score = float(hit["score"])
                
                results.append({
                    "chunk_id": str(hit.payload.get("chunk_id", "")),
                    "document_id": str(hit.payload.get("document_id", "")),
                    "content": hit.payload.get("content", "")[:500],  # Limit content length
                    "score": score,
                })
            
            logger.info(
                "tool_executor.search_knowledge.complete",
                query=query[:100],
                results_count=len(results)
            )
            report_retrieval_query_usage(usage_user_id, queries=1)

            return {
                "results": results,
                "count": len(results)
            }
        except Exception as exc:
            logger.error("tool_executor.search_knowledge.failed", error=str(exc), exc_info=True)
            return {
                "error": f"Search failed: {str(exc)}",
                "results": [],
                "count": 0
            }
    
    async def _get_target_group_knowledge(
        self, arguments: Dict[str, Any], usage_user_id: str | None = None
    ) -> Dict[str, Any]:
        """Execute get_target_group_knowledge tool."""
        target_group_id = arguments.get("target_group_id", "")
        limit = min(arguments.get("limit", 10), 50)
        
        if not target_group_id:
            return {
                "error": "target_group_id is required",
                "results": [],
                "count": 0
            }
        
        try:
            # Validate UUID format
            UUID(target_group_id)
        except ValueError:
            return {
                "error": "Invalid target_group_id format (must be UUID)",
                "results": [],
                "count": 0
            }
        
        # For now, use a semantic search approach since KnowledgeExplorerService
        # requires models from api app that may not be available here
        # TODO: Consider making an API call to api app or sharing the service
        
        # Try to search with target_group_id filter via Qdrant
        try:
            
            # Search for chunks with target_group_id in payload
            # This is a simplified approach - ideally we'd use KnowledgeExplorerService
            query = "target group knowledge"
            _, hits = self.retrieval_agent.run(query=query, persona_segment=None)
            report_retrieval_query_usage(usage_user_id, queries=1)

            # Filter by target_group_id if available in payload
            filtered_results = []
            for hit in hits:
                if not hit.payload:
                    continue
                if str(hit.payload.get("target_group_id", "")) == target_group_id:
                    score = 0.0
                    if hasattr(hit, "score"):
                        score = float(hit.score)
                    elif isinstance(hit, dict) and "score" in hit:
                        score = float(hit["score"])
                    
                    filtered_results.append({
                        "chunk_id": str(hit.payload.get("chunk_id", "")),
                        "document_id": str(hit.payload.get("document_id", "")),
                        "content": hit.payload.get("content", "")[:500],
                        "score": score,
                    })
                    
                    if len(filtered_results) >= limit:
                        break
            
            logger.info(
                "tool_executor.get_target_group_knowledge.complete",
                target_group_id=target_group_id,
                results_count=len(filtered_results)
            )
            
            return {
                "results": filtered_results,
                "count": len(filtered_results)
            }
        except Exception as exc:
            logger.error(
                "tool_executor.get_target_group_knowledge.failed",
                error=str(exc),
                exc_info=True
            )
            return {
                "error": f"Failed to retrieve target group knowledge: {str(exc)}",
                "results": [],
                "count": 0
            }
    
    async def _get_document_content(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Execute get_document_content tool."""
        document_id = arguments.get("document_id", "")
        
        if not document_id:
            return {
                "error": "document_id is required",
                "content": "",
                "chunks": []
            }
        
        try:
            # Validate UUID format
            doc_uuid = UUID(document_id)
        except ValueError:
            return {
                "error": "Invalid document_id format (must be UUID)",
                "content": "",
                "chunks": []
            }
        
        try:
            # Get all chunks for this document from database
            with get_session() as session:
                chunks = session.scalars(
                    select(DocumentChunk)
                    .where(DocumentChunk.document_id == doc_uuid)
                    .order_by(DocumentChunk.chunk_metadata["order"].astext.cast(int).nulls_last())
                ).all()
                
                if not chunks:
                    return {
                        "error": "Document not found or has no chunks",
                        "content": "",
                        "chunks": []
                    }
                
                # Combine chunk content in order
                content_parts = []
                chunk_list = []
                
                for chunk in chunks:
                    chunk_content = chunk.content or ""
                    content_parts.append(chunk_content)
                    
                    chunk_list.append({
                        "chunk_id": str(chunk.id),
                        "content": chunk_content[:500],  # Limit for individual chunks
                        "metadata": chunk.chunk_metadata or {}
                    })
                
                full_content = "\n\n".join(content_parts)
                
                logger.info(
                    "tool_executor.get_document_content.complete",
                    document_id=document_id,
                    chunks_count=len(chunks)
                )
                
                return {
                    "content": full_content[:5000],  # Limit full content length
                    "chunks": chunk_list,
                    "chunks_count": len(chunks)
                }
        except Exception as exc:
            logger.error(
                "tool_executor.get_document_content.failed",
                error=str(exc),
                exc_info=True
            )
            return {
                "error": f"Failed to retrieve document content: {str(exc)}",
                "content": "",
                "chunks": []
            }

    # ------------------------------------------------------------------ #
    # Action tool: inspect_website (delegates to apps/ux-journey-agent)  #
    # ------------------------------------------------------------------ #

    async def _inspect_website(
        self,
        arguments: Dict[str, Any],
        persona_context: Dict[str, Any] | None,
        send_event: Callable[[Any], None] | None,
    ) -> Dict[str, Any]:
        """
        Trigger a UX-Journey browse against `arguments["url"]` and stream live
        progress to the chat client via `send_event`. Blocks until the journey
        completes (or times out) so the LLM can summarize the persona's
        experience in its follow-up reply.
        """
        url = (arguments.get("url") or "").strip()
        task = (arguments.get("task") or "").strip()
        max_steps_arg = arguments.get("max_steps")

        if not url or not task:
            return {
                "ok": False,
                "error": "Both 'url' and 'task' are required.",
            }

        try:
            max_steps = int(max_steps_arg) if max_steps_arg is not None else settings.ux_journey_inspect_default_max_steps
        except (TypeError, ValueError):
            max_steps = settings.ux_journey_inspect_default_max_steps
        max_steps = max(3, min(30, max_steps))

        base_url = (settings.ux_journey_agent_url or "").strip().rstrip("/")
        if not base_url:
            logger.warning("tool_executor.inspect_website.unconfigured")
            return {
                "ok": False,
                "error": (
                    "The UX Journey Agent is not configured for this environment. "
                    "Tell the user that live website inspection is currently unavailable."
                ),
            }

        # Step 0: optional human-in-the-loop confirmation. The persona agent
        # runs this coroutine inside `asyncio.run(...)` from the worker thread
        # (see PersonaAgent._stream_response_with_tools), so we can safely
        # off-load the blocking `threading.Event.wait` to a thread without
        # starving the chat-api FastAPI loop.
        if settings.chat_action_tools_require_confirmation and send_event is not None:
            persona_name = (
                (persona_context or {}).get("name") if isinstance(persona_context, dict) else None
            )
            call_id = uuid.uuid4().hex
            tool_decisions.register(call_id)
            try:
                send_event(
                    ToolProposedEvent(
                        tool="inspect_website",
                        call_id=call_id,
                        arguments={"url": url, "task": task, "max_steps": max_steps},
                        prompt_text=_build_confirm_prompt(url=url, task=task, persona_name=persona_name),
                    )
                )
            except Exception as exc:
                logger.warning("tool_executor.inspect_website.proposed_event_failed", error=str(exc))
                tool_decisions.cancel_pending(call_id)
                # Fail closed: don't silently auto-run if the proposal can't reach the user.
                return {
                    "ok": False,
                    "denied": True,
                    "error": "Could not send the confirmation prompt to the user.",
                }

            confirm_timeout = float(settings.chat_action_tools_confirmation_timeout_seconds or 120.0)
            decision, reason = await asyncio.to_thread(
                tool_decisions.wait_for_decision,
                call_id,
                timeout_seconds=confirm_timeout,
            )
            logger.info(
                "tool_executor.inspect_website.decision",
                call_id=call_id,
                decision=decision,
                reason=reason,
            )
            if decision == "deny":
                # Return a structured tool result the LLM can react to. The
                # persona prompt instructs it to acknowledge the user's "no"
                # gracefully and continue without browsing.
                return {
                    "ok": False,
                    "denied": True,
                    "call_id": call_id,
                    "reason": reason or "User declined the website inspection.",
                    "summary_text": (
                        f"User declined to let me browse {url}. I will answer based on "
                        f"what I already know without visiting the site."
                    ),
                }

        run_payload = {
            "url": url,
            "task": task,
            "max_steps": max_steps,
        }
        if persona_context:
            run_payload["persona"] = persona_context

        # Step 1: start the run.
        request_timeout = float(settings.ux_journey_agent_timeout_seconds or 60.0)
        try:
            async with httpx.AsyncClient(timeout=request_timeout, follow_redirects=True) as client:
                start_res = await client.post(f"{base_url}/run", json=run_payload)
        except httpx.HTTPError as exc:
            logger.error("tool_executor.inspect_website.start_failed", error=str(exc), exc_info=True)
            return {
                "ok": False,
                "error": f"Could not reach the UX Journey Agent: {exc!s}",
            }

        if start_res.status_code >= 400:
            logger.warning(
                "tool_executor.inspect_website.start_http_error",
                status_code=start_res.status_code,
                body_preview=start_res.text[:240],
            )
            return {
                "ok": False,
                "error": f"UX Journey Agent rejected the request (HTTP {start_res.status_code}).",
            }

        try:
            start_data = start_res.json()
        except Exception:
            start_data = {}
        job_id = (start_data.get("jobId") or start_data.get("job_id") or "").strip()
        if not job_id:
            return {
                "ok": False,
                "error": "UX Journey Agent did not return a jobId.",
            }

        logger.info(
            "tool_executor.inspect_website.started",
            job_id=job_id,
            url=url,
            max_steps=max_steps,
        )

        if send_event is not None:
            try:
                send_event(
                    ToolStartedEvent(
                        tool="inspect_website",
                        job_id=job_id,
                        url=url,
                        task=task,
                    )
                )
            except Exception as exc:
                logger.warning("tool_executor.inspect_website.start_event_failed", error=str(exc))

        # Step 2: poll until the run completes (or we hit the safety budget).
        poll_interval = max(0.5, float(settings.ux_journey_poll_interval_seconds or 2.0))
        total_budget = float(settings.ux_journey_inspect_total_timeout_seconds or 360.0)
        # `stagnation_budget` is the inactivity threshold: how long we accept
        # zero step movement before we declare the agent stalled. Set < total
        # so a stuck run aborts long before the hard ceiling.
        stagnation_budget = float(settings.ux_journey_inspect_stagnation_seconds or 75.0)
        deadline = time.monotonic() + total_budget

        final_status: str = "running"
        final_result: Dict[str, Any] = {}
        final_error: str | None = None
        last_emitted_step_count = -1
        last_step_change_at = time.monotonic()
        last_seen_step_count = 0

        async with httpx.AsyncClient(timeout=request_timeout, follow_redirects=True) as poll_client:
            while True:
                now = time.monotonic()
                if now >= deadline:
                    final_error = "inspect_website timed out before the journey finished."
                    logger.warning(
                        "tool_executor.inspect_website.timeout",
                        job_id=job_id,
                        budget_s=total_budget,
                    )
                    break

                # Stagnation watchdog: if the upstream agent stopped producing
                # new steps but never flipped its status, we declare it stalled
                # so the chat can recover. We only arm the watchdog after at
                # least one step has been observed (a fresh run with 0 steps
                # for the first 30s is normal page-load latency, not a stall).
                if (
                    last_seen_step_count > 0
                    and (now - last_step_change_at) >= stagnation_budget
                ):
                    final_error = (
                        f"inspect_website stalled — no new steps for {int(stagnation_budget)}s "
                        f"after step {last_seen_step_count}. The browser agent is likely stuck."
                    )
                    logger.warning(
                        "tool_executor.inspect_website.stagnation",
                        job_id=job_id,
                        last_step=last_seen_step_count,
                        stagnation_s=stagnation_budget,
                    )
                    break

                try:
                    res = await poll_client.get(f"{base_url}/run/{job_id}")
                except httpx.HTTPError as exc:
                    logger.warning(
                        "tool_executor.inspect_website.poll_failed",
                        job_id=job_id,
                        error=str(exc),
                    )
                    await asyncio.sleep(poll_interval)
                    continue

                if res.status_code == 404:
                    final_error = "UX Journey Agent forgot the job (404)."
                    break
                if res.status_code >= 400:
                    logger.warning(
                        "tool_executor.inspect_website.poll_http_error",
                        job_id=job_id,
                        status_code=res.status_code,
                    )
                    await asyncio.sleep(poll_interval)
                    continue

                try:
                    data = res.json()
                except Exception:
                    data = {}

                status_str = str(data.get("status") or "running").lower()
                result_obj = data.get("result") if isinstance(data.get("result"), dict) else {}
                steps_raw = result_obj.get("steps") if isinstance(result_obj, dict) else None
                steps_list: List[Dict[str, Any]] = (
                    [s for s in steps_raw if isinstance(s, dict)] if isinstance(steps_raw, list) else []
                )

                # Reset the stagnation watchdog whenever the upstream produced
                # progress — even if the SSE forwarder hasn't yet emitted a
                # new event for it (we use the raw step count here).
                if len(steps_list) != last_seen_step_count:
                    last_step_change_at = now
                    last_seen_step_count = len(steps_list)

                # Emit progress event when steps change. We trim screenshots out
                # of the SSE payload (they are served as separate JPEG endpoints)
                # to keep frames small.
                if send_event is not None and len(steps_list) != last_emitted_step_count:
                    last_emitted_step_count = len(steps_list)
                    try:
                        send_event(
                            ToolProgressEvent(
                                tool="inspect_website",
                                job_id=job_id,
                                status=status_str,
                                steps=[_compact_step_for_sse(s) for s in steps_list[-12:]],
                                steps_total=len(steps_list),
                            )
                        )
                    except Exception as exc:
                        logger.warning(
                            "tool_executor.inspect_website.progress_event_failed",
                            error=str(exc),
                        )

                upstream_error = data.get("error") if isinstance(data.get("error"), str) else None
                has_terminal_success = (
                    isinstance(result_obj, dict) and result_obj.get("success") in (True, False)
                )
                if status_str in ("complete", "completed", "done") or has_terminal_success or status_str == "error":
                    final_status = status_str
                    final_result = result_obj or {}
                    if upstream_error:
                        final_error = upstream_error
                    break

                await asyncio.sleep(poll_interval)

        # Step 3: emit completion event and build the compact tool-result for the LLM.
        success = final_result.get("success") if isinstance(final_result, dict) else None
        steps_final_raw = final_result.get("steps") if isinstance(final_result, dict) else []
        steps_final: List[Dict[str, Any]] = (
            [s for s in steps_final_raw if isinstance(s, dict)] if isinstance(steps_final_raw, list) else []
        )
        video_url_rel = final_result.get("videoUrl") if isinstance(final_result, dict) else None

        if send_event is not None:
            try:
                send_event(
                    ToolCompletedEvent(
                        tool="inspect_website",
                        job_id=job_id,
                        success=success if isinstance(success, bool) else None,
                        video_url=video_url_rel if isinstance(video_url_rel, str) else None,
                        error=final_error,
                    )
                )
            except Exception as exc:
                logger.warning("tool_executor.inspect_website.complete_event_failed", error=str(exc))

        # Compact summary for the LLM. We deliberately exclude screenshots and
        # large reasoning blocks — only the essence per step.
        key_findings = []
        for step in steps_final[-5:]:
            key_findings.append(
                {
                    "step": step.get("step"),
                    "action": step.get("action"),
                    "target": _truncate(step.get("target"), 160),
                    "result": _truncate(step.get("result"), 240),
                }
            )

        summary_text = _build_summary_text(
            url=url,
            task=task,
            steps_count=len(steps_final),
            success=success,
            error=final_error,
            site_domain=final_result.get("siteDomain") if isinstance(final_result, dict) else None,
        )

        logger.info(
            "tool_executor.inspect_website.complete",
            job_id=job_id,
            success=success,
            steps_count=len(steps_final),
            had_error=bool(final_error),
        )

        tool_result: Dict[str, Any] = {
            "ok": final_error is None,
            "jobId": job_id,
            "status": final_status,
            "success": success,
            "summary_text": summary_text,
            "key_findings": key_findings,
            "url": url,
            "task": task,
        }
        if video_url_rel:
            tool_result["video_url"] = video_url_rel
        if final_error:
            tool_result["error"] = final_error
        return tool_result


def _build_confirm_prompt(*, url: str, task: str, persona_name: str | None) -> str:
    """
    Short German confirm-prompt rendered in the chat UI's confirm CTA. We keep
    the language deliberately simple so the same string works whether the
    user chats in DE or EN — the persona's actual reply later will pick up the
    user's language.
    """
    who = (persona_name or "").strip() or "die Persona"
    short_task = task if len(task) <= 140 else task[:137].rstrip() + "…"
    return (
        f"Soll {who} **{url}** live im Browser besuchen?\n\n"
        f"_Auftrag: {short_task}_"
    )


def _compact_step_for_sse(step: Dict[str, Any]) -> Dict[str, Any]:
    """Trim a single step entry to fields the chat panel renders."""
    return {
        "step": step.get("step"),
        "action": step.get("action"),
        "target": step.get("target"),
        "result": step.get("result"),
        "reasoning": step.get("reasoning"),
        "reasoningMeta": step.get("reasoningMeta") or step.get("reasoning_meta"),
        "screenshotUrl": step.get("screenshotUrl") or step.get("screenshot_url"),
        "timestamp": step.get("timestamp"),
    }


def _truncate(value: Any, limit: int) -> str | None:
    if value is None:
        return None
    s = str(value)
    if len(s) <= limit:
        return s
    return s[: max(0, limit - 1)].rstrip() + "…"


def _build_summary_text(
    *,
    url: str,
    task: str,
    steps_count: int,
    success: Any,
    error: str | None,
    site_domain: str | None,
) -> str:
    """Compact human-readable summary the LLM can quote / build on."""
    if error:
        return (
            f"Tried to browse {url} as the persona but the journey was interrupted: {error}. "
            f"Steps observed before the interruption: {steps_count}."
        )
    where = site_domain or url
    success_phrase = (
        "completed the visit successfully"
        if success is True
        else "could not finish the task" if success is False else "finished the visit"
    )
    return (
        f"Visited {where} for the task '{task}' and {success_phrase} "
        f"after {steps_count} step(s)."
    )

