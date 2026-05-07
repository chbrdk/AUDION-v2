"""Shared SSE streaming pipeline for persona chat (used by /message and /message/stream)."""

from __future__ import annotations

import asyncio
import json
import queue
import threading
import time
from dataclasses import dataclass
from typing import Any, AsyncIterator, Dict, List, Optional

import structlog
from msqdx_glass_proto import CompleteEvent, ContentDeltaEvent, ReasoningDeltaEvent, SourcesEvent, ThinkingEvent

from ..agents.events import ToolCompletedEvent, ToolProgressEvent, ToolStartedEvent
from ..core.config import get_settings
from ..services.usage_report import report_retrieval_query_usage, report_usage
from ..utils.openai_chat_stream import iter_chat_completion_stream_parts
from ..utils.turn_naturalness import TurnSessionState, compose_persona_system_prompt, finalize_turn_session_after_assistant
from ..utils.text import clean_response_text
from ..ws.chat import get_persona_agent, get_retrieval_agent

# Keepalive comment line (SSE spec: lines starting with ":" are ignored by clients).
# Sent on idle while a long-running tool is busy, so reverse proxies (Coolify/nginx)
# don't drop the connection on read-timeout. Note: parser must not treat "data: …"
# strictly — most browsers tolerate stray comment lines.
_SSE_KEEPALIVE = ": ping\n\n"
_SSE_KEEPALIVE_INTERVAL_SECONDS = 15.0

logger = structlog.get_logger(__name__)
settings = get_settings()


@dataclass
class ChatStreamContext:
    """Immutable inputs for one chat completion (stream or buffered JSON)."""

    persona_id: str
    user_id: str | None
    system_prompt: str
    anthropic_messages: List[Dict[str, Any]]
    retrieval_query: str
    user_message_for_logging: str
    persona_segment: str | None
    use_tools: bool
    tools: Any
    reply_mode: str = "standard"
    turn_naturalness_addendum: str = ""
    turn_session_state: Optional[TurnSessionState] = None
    # Compact persona snapshot forwarded to action tools (e.g. inspect_website
    # passes this through to ux-journey-agent so the browse runs "as the persona").
    # Schema mirrors the manual UX-journey trigger in apps/web/app/admin/chat/page.tsx
    # (id, name, headline, profile, systemPrompt). Optional — tools must handle None.
    persona_context: Optional[Dict[str, Any]] = None


def _event_to_sse_chunks(
    event: object,
    ctx: ChatStreamContext,
    emit_sanitized_delta,
    usage_reported: List[bool],
) -> List[str]:
    """
    Translate one PersonaAgent event (model from msqdx_glass_proto OR a local
    tool lifecycle event) into the SSE `data: ...` line(s) the frontend expects.

    Returning a list (not yielding) keeps this trivially callable from both the
    drain-after-thread-exit branch and the normal hot loop in `iter_chat_sse`.
    """
    chunks: List[str] = []
    if isinstance(event, ContentDeltaEvent):
        delta_payload = emit_sanitized_delta(event.delta)
        if delta_payload:
            chunks.append(f"data: {json.dumps({'type': 'delta', 'delta': delta_payload})}\n\n")
    elif isinstance(event, ReasoningDeltaEvent) and event.delta:
        chunks.append(f"data: {json.dumps({'type': 'reasoning_delta', 'delta': event.delta})}\n\n")
    elif isinstance(event, SourcesEvent):
        chunks.append(f"data: {json.dumps({'type': 'sources', 'sources': event.sources})}\n\n")
    elif isinstance(event, CompleteEvent):
        chunks.append(f"data: {json.dumps({'type': 'complete'})}\n\n")
        if ctx.user_id and not usage_reported[0]:
            usage_reported[0] = True
            report_usage(
                user_id=ctx.user_id,
                event_type="chat_message",
                raw_units={"runs": 1},
            )
    elif isinstance(event, ToolStartedEvent):
        chunks.append(
            "data: "
            + json.dumps(
                {
                    "type": "tool_started",
                    "tool": event.tool,
                    "jobId": event.job_id,
                    "url": event.url,
                    "task": event.task,
                }
            )
            + "\n\n"
        )
    elif isinstance(event, ToolProgressEvent):
        chunks.append(
            "data: "
            + json.dumps(
                {
                    "type": "tool_progress",
                    "tool": event.tool,
                    "jobId": event.job_id,
                    "status": event.status,
                    "steps": event.steps,
                    "stepsTotal": event.steps_total,
                }
            )
            + "\n\n"
        )
    elif isinstance(event, ToolCompletedEvent):
        chunks.append(
            "data: "
            + json.dumps(
                {
                    "type": "tool_completed",
                    "tool": event.tool,
                    "jobId": event.job_id,
                    "success": event.success,
                    "videoUrl": event.video_url,
                    "error": event.error,
                }
            )
            + "\n\n"
        )
    elif isinstance(event, ThinkingEvent):
        if hasattr(event, "status") and event.status and "error" in event.status.lower():
            error_msg = event.status.replace("Error generating response: ", "")
            chunks.append(f"data: {json.dumps({'type': 'error', 'error': error_msg})}\n\n")
    return chunks


async def iter_chat_sse(ctx: ChatStreamContext) -> AsyncIterator[str]:
    """Yield Server-Sent Event lines (`data: …\\n\\n`) for one chat request."""
    usage_reported = [False]
    try:
        loop = asyncio.get_event_loop()
        persona_agent = get_persona_agent()

        if ctx.use_tools and ctx.tools:
            logger.info(
                "chat.stream.tools_enabled",
                persona_id=ctx.persona_id,
                tools_count=len(ctx.tools),
            )

            event_queue: queue.Queue[object] = queue.Queue()
            stream_error: list[Exception | None] = [None]

            def send_event(event: object) -> None:
                logger.debug("chat.stream.event_queued", event_type=type(event).__name__)
                event_queue.put(event)

            sources: list[dict] = []

            def run_persona_stream() -> None:
                try:
                    user_assistant_messages = [
                        msg for msg in ctx.anthropic_messages if msg.get("role") in ["user", "assistant"]
                    ]
                    persona_agent.stream_response(
                        system_prompt=ctx.system_prompt,
                        messages=user_assistant_messages,
                        sources=sources,
                        persona_id=ctx.persona_id,
                        send_event=send_event,
                        tools=ctx.tools,
                        persona_segment=ctx.persona_segment,
                        use_tools=True,
                        usage_user_id=ctx.user_id,
                        reply_mode=ctx.reply_mode,
                        turn_naturalness_addendum=ctx.turn_naturalness_addendum,
                        persona_context=ctx.persona_context,
                    )
                except Exception as e:
                    logger.error("chat.stream.persona_agent_failed", error=str(e), exc_info=True)
                    stream_error[0] = e
                finally:
                    event_queue.put(None)

            stream_thread = threading.Thread(target=run_persona_stream, daemon=True)
            stream_thread.start()

            response_buffer = ""
            sanitized_sent = ""

            def emit_sanitized_delta(delta_text: str) -> str:
                nonlocal response_buffer, sanitized_sent
                response_buffer += delta_text
                sanitized = clean_response_text(response_buffer, max_paragraphs=None)
                max_len = min(len(sanitized), len(sanitized_sent))
                prefix_len = 0
                while prefix_len < max_len and sanitized[prefix_len] == sanitized_sent[prefix_len]:
                    prefix_len += 1
                delta_payload = sanitized[prefix_len:]
                sanitized_sent = sanitized
                return delta_payload

            logger.info("chat.stream.queue_processing_started", persona_id=ctx.persona_id)
            last_yield_at = time.monotonic()
            while True:
                try:
                    event = await loop.run_in_executor(
                        None,
                        lambda: event_queue.get(timeout=0.1),
                    )
                    logger.debug("chat.stream.event_received", event_type=type(event).__name__ if event else "None")
                except queue.Empty:
                    if not stream_thread.is_alive():
                        try:
                            while True:
                                event = event_queue.get_nowait()
                                if event is None:
                                    break
                                for sse_chunk in _event_to_sse_chunks(event, ctx, emit_sanitized_delta, usage_reported):
                                    yield sse_chunk
                                    last_yield_at = time.monotonic()
                        except queue.Empty:
                            pass
                        if stream_error[0]:
                            raise stream_error[0]
                        break
                    # Keep proxies awake while a long-running tool is busy.
                    if time.monotonic() - last_yield_at >= _SSE_KEEPALIVE_INTERVAL_SECONDS:
                        yield _SSE_KEEPALIVE
                        last_yield_at = time.monotonic()
                    await asyncio.sleep(0.01)
                    continue

                if event is None:
                    if stream_error[0]:
                        raise stream_error[0]
                    break

                for sse_chunk in _event_to_sse_chunks(event, ctx, emit_sanitized_delta, usage_reported):
                    yield sse_chunk
                    last_yield_at = time.monotonic()

            stream_thread.join(timeout=2)
            logger.info("chat.stream.tools_complete", persona_id=ctx.persona_id)
            if stream_error[0] is None:
                finalize_turn_session_after_assistant(ctx.turn_session_state)

        else:
            logger.info("chat.stream.legacy_mode", persona_id=ctx.persona_id)

            retrieval_task = asyncio.create_task(
                asyncio.wait_for(
                    loop.run_in_executor(
                        None,
                        lambda: get_retrieval_agent().run(query=ctx.retrieval_query, persona_segment=None),
                    ),
                    timeout=10.0,
                )
            )

            yield f"data: {json.dumps({'type': 'sources', 'sources': []})}\n\n"

            sentinel = object()
            queue_container: dict[str, queue.Queue[object]] = {"queue": queue.Queue()}
            stream_error: list[Exception | None] = [None]

            def collect_stream_deltas() -> None:
                stream_queue = queue_container["queue"]
                try:
                    system_content = compose_persona_system_prompt(
                        ctx.system_prompt,
                        reply_mode="extended" if ctx.reply_mode == "extended" else "standard",
                        turn_naturalness_addendum=ctx.turn_naturalness_addendum,
                    )
                    openai_messages = [{"role": "system", "content": system_content}]
                    for msg in ctx.anthropic_messages:
                        openai_messages.append(
                            {
                                "role": msg.get("role", "user"),
                                "content": msg.get("content", ""),
                            }
                        )

                    effort = (
                        settings.chat_reasoning_effort_extended
                        if ctx.reply_mode == "extended"
                        else settings.chat_reasoning_effort_standard
                    )
                    for content, reasoning in iter_chat_completion_stream_parts(
                        persona_agent._openai,
                        reasoning_effort=effort,
                        model=settings.chat_model,
                        messages=openai_messages,
                        max_completion_tokens=settings.chat_max_completion_tokens,
                        stream=True,
                    ):
                        if reasoning:
                            stream_queue.put(("reasoning", reasoning))
                        if content:
                            stream_queue.put(("content", content))
                except Exception as e:
                    logger.error("chat.stream.collect_failed", error=str(e), exc_info=True)
                    stream_error[0] = e
                finally:
                    stream_queue.put(sentinel)

            thread = threading.Thread(target=collect_stream_deltas, daemon=True)
            thread.start()

            stream_data_queue = queue_container["queue"]

            def get_item_with_timeout() -> object | None:
                try:
                    return stream_data_queue.get(timeout=0.1)
                except queue.Empty:
                    return None

            response_buffer = ""
            sanitized_sent = ""

            def emit_sanitized_delta(delta_text: str) -> str:
                nonlocal response_buffer, sanitized_sent
                response_buffer += delta_text
                sanitized = clean_response_text(response_buffer, max_paragraphs=None)
                max_len = min(len(sanitized), len(sanitized_sent))
                prefix_len = 0
                while prefix_len < max_len and sanitized[prefix_len] == sanitized_sent[prefix_len]:
                    prefix_len += 1
                delta_payload = sanitized[prefix_len:]
                sanitized_sent = sanitized
                return delta_payload

            while True:
                item = await loop.run_in_executor(None, get_item_with_timeout)

                if item is None:
                    if not thread.is_alive():
                        try:
                            while True:
                                item = stream_data_queue.get_nowait()
                                if item is sentinel:
                                    break
                                if (
                                    isinstance(item, tuple)
                                    and len(item) == 2
                                    and item[0] == "reasoning"
                                    and isinstance(item[1], str)
                                    and item[1]
                                ):
                                    yield f"data: {json.dumps({'type': 'reasoning_delta', 'delta': item[1]})}\n\n"
                                elif (
                                    isinstance(item, tuple)
                                    and len(item) == 2
                                    and item[0] == "content"
                                    and isinstance(item[1], str)
                                ):
                                    delta_payload = emit_sanitized_delta(item[1])
                                    if delta_payload:
                                        yield f"data: {json.dumps({'type': 'delta', 'delta': delta_payload})}\n\n"
                        except queue.Empty:
                            pass
                        if stream_error[0]:
                            raise stream_error[0]
                        break
                    await asyncio.sleep(0.01)
                    continue

                if item is sentinel:
                    if stream_error[0]:
                        raise stream_error[0]
                    break

                if (
                    isinstance(item, tuple)
                    and len(item) == 2
                    and item[0] == "reasoning"
                    and isinstance(item[1], str)
                    and item[1]
                ):
                    yield f"data: {json.dumps({'type': 'reasoning_delta', 'delta': item[1]})}\n\n"
                elif (
                    isinstance(item, tuple)
                    and len(item) == 2
                    and item[0] == "content"
                    and isinstance(item[1], str)
                ):
                    delta_payload = emit_sanitized_delta(item[1])
                    if delta_payload:
                        yield f"data: {json.dumps({'type': 'delta', 'delta': delta_payload})}\n\n"

            thread.join(timeout=1)

            try:
                if retrieval_task.done():
                    _embedding, hits = retrieval_task.result()
                    logger.info("chat.stream.retrieval.complete", hits_count=len(hits))
                    report_retrieval_query_usage(ctx.user_id, queries=1)

                    sources = [
                        {
                            "chunk_id": str(hit.payload.get("chunk_id", "")),
                            "document_id": str(hit.payload.get("document_id", "")),
                            "title": hit.payload.get("title", "Research"),
                            "confidence": float(hit.score) if hasattr(hit, "score") else 0.8,
                            "excerpt": hit.payload.get("content", ""),
                        }
                        for hit in hits[:5]
                        if hit.payload
                    ]

                    if sources:
                        yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"
            except (asyncio.TimeoutError, asyncio.CancelledError, Exception) as e:
                logger.warning("chat.stream.retrieval.skipped", error=str(e))

            yield f"data: {json.dumps({'type': 'complete'})}\n\n"
            logger.info("chat.stream.persona_agent.complete")
            finalize_turn_session_after_assistant(ctx.turn_session_state)
            if ctx.user_id and not usage_reported[0]:
                usage_reported[0] = True
                report_usage(
                    user_id=ctx.user_id,
                    event_type="chat_message",
                    raw_units={"runs": 1},
                )
    except Exception as e:
        logger.error("chat.stream.error", error=str(e), exc_info=True)
        yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
