"""Shared SSE streaming pipeline for persona chat (used by /message and /message/stream)."""

from __future__ import annotations

import asyncio
import json
import queue
import threading
from dataclasses import dataclass
from typing import Any, AsyncIterator, Dict, List

import structlog
from msqdx_glass_proto import CompleteEvent, ContentDeltaEvent, ReasoningDeltaEvent, SourcesEvent, ThinkingEvent

from ..core.config import get_settings
from ..services.usage_report import report_retrieval_query_usage, report_usage
from ..utils.openai_chat_stream import iter_chat_completion_stream_parts
from ..utils.turn_naturalness import compose_persona_system_prompt
from ..utils.text import clean_response_text
from ..ws.chat import get_persona_agent, get_retrieval_agent

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
                                if isinstance(event, ContentDeltaEvent):
                                    delta_payload = emit_sanitized_delta(event.delta)
                                    if delta_payload:
                                        yield f"data: {json.dumps({'type': 'delta', 'delta': delta_payload})}\n\n"
                                elif isinstance(event, ReasoningDeltaEvent) and event.delta:
                                    yield f"data: {json.dumps({'type': 'reasoning_delta', 'delta': event.delta})}\n\n"
                                elif isinstance(event, SourcesEvent):
                                    yield f"data: {json.dumps({'type': 'sources', 'sources': event.sources})}\n\n"
                                elif isinstance(event, CompleteEvent):
                                    yield f"data: {json.dumps({'type': 'complete'})}\n\n"
                                    if ctx.user_id and not usage_reported[0]:
                                        usage_reported[0] = True
                                        report_usage(
                                            user_id=ctx.user_id,
                                            event_type="chat_message",
                                            raw_units={"runs": 1},
                                        )
                                elif isinstance(event, ThinkingEvent):
                                    pass
                        except queue.Empty:
                            pass
                        if stream_error[0]:
                            raise stream_error[0]
                        break
                    await asyncio.sleep(0.01)
                    continue

                if event is None:
                    if stream_error[0]:
                        raise stream_error[0]
                    break

                if isinstance(event, ContentDeltaEvent):
                    logger.debug(
                        "chat.stream.content_delta_event",
                        delta_length=len(event.delta) if event.delta else 0,
                    )
                    delta_payload = emit_sanitized_delta(event.delta)
                    if delta_payload:
                        yield f"data: {json.dumps({'type': 'delta', 'delta': delta_payload})}\n\n"
                elif isinstance(event, ReasoningDeltaEvent) and event.delta:
                    yield f"data: {json.dumps({'type': 'reasoning_delta', 'delta': event.delta})}\n\n"
                elif isinstance(event, SourcesEvent):
                    yield f"data: {json.dumps({'type': 'sources', 'sources': event.sources})}\n\n"
                elif isinstance(event, CompleteEvent):
                    yield f"data: {json.dumps({'type': 'complete'})}\n\n"
                    if ctx.user_id and not usage_reported[0]:
                        usage_reported[0] = True
                        report_usage(
                            user_id=ctx.user_id,
                            event_type="chat_message",
                            raw_units={"runs": 1},
                        )
                elif isinstance(event, ThinkingEvent):
                    if hasattr(event, "status") and event.status and "error" in event.status.lower():
                        error_msg = event.status.replace("Error generating response: ", "")
                        yield f"data: {json.dumps({'type': 'error', 'error': error_msg})}\n\n"

            stream_thread.join(timeout=2)
            logger.info("chat.stream.tools_complete", persona_id=ctx.persona_id)

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
