from __future__ import annotations

import json
from typing import List, Dict, Any
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import select

from ..core.config import get_settings
from ..core.http_exceptions import exception_to_http
from ..db import get_session
from ..models import Persona, PersonaPrompt
from ..ws.chat import get_persona_prompt
from ..deps import verify_request_token
from ..utils.turn_naturalness import build_turn_naturalness_spec, extract_last_two_user_texts
from .images import get_image_data_url
from .chat_stream import ChatStreamContext, iter_chat_sse

router = APIRouter(prefix="/chat", tags=["chat"])
logger = structlog.get_logger(__name__)
settings = get_settings()


def convert_message_with_images(msg: ChatMessage) -> Dict[str, Any]:
    """
    Konvertiert eine Message mit Bildern (via Image-IDs) in OpenAI Vision Format.
    """
    if not msg.image_ids or len(msg.image_ids) == 0:
        return {
            "role": msg.role,
            "content": msg.content,
        }

    logger.info("chat.image.processing", role=msg.role, image_count=len(msg.image_ids))

    content_blocks = []

    if msg.content and msg.content.strip():
        content_blocks.append({
            "type": "text",
            "text": msg.content,
        })

    for idx, image_id in enumerate(msg.image_ids):
        image_data_url = get_image_data_url(image_id)

        if not image_data_url:
            logger.warning("chat.image.not_found", image_id=image_id, image_index=idx)
            continue

        if image_data_url.startswith("data:image/"):
            logger.info(
                "chat.image.loaded",
                image_index=idx,
                image_id=image_id,
                data_url_length=len(image_data_url),
            )

            content_blocks.append({
                "type": "image_url",
                "image_url": {
                    "url": image_data_url,
                },
            })
        else:
            logger.warning("chat.image.invalid_data_url", image_id=image_id, image_index=idx)

    if not content_blocks or all(block.get("type") == "image_url" for block in content_blocks):
        content_blocks.insert(0, {
            "type": "text",
            "text": msg.content if msg.content else "",
        })

    logger.info(
        "chat.image.conversion_complete",
        role=msg.role,
        total_blocks=len(content_blocks),
        text_blocks=sum(1 for b in content_blocks if b.get("type") == "text"),
        image_blocks=sum(1 for b in content_blocks if b.get("type") == "image_url"),
    )

    return {
        "role": msg.role,
        "content": content_blocks,
    }


class ChatMessage(BaseModel):
    role: str  # "system", "user", "assistant"
    content: str
    image_ids: List[str] | None = Field(default=None, description="IDs von hochgeladenen Bildern (via /images/upload)")


class ChatMessageRequest(BaseModel):
    persona_id: str
    message: str | None = Field(default=None)  # Legacy: single message string
    messages: List[ChatMessage] | None = Field(default=None)  # New: messages array with conversation history
    user_id: str | None = Field(default=None, description="PLEXON user id (or internal id) for usage tracking")

    @model_validator(mode="after")
    def validate_message_or_messages(self):
        """Ensure either message or messages is provided."""
        if not self.message and not self.messages:
            raise ValueError("Either 'message' or 'messages' must be provided")
        return self


class ChatSource(BaseModel):
    chunk_id: str
    document_id: str
    title: str
    confidence: float
    excerpt: str


class ChatMessageResponse(BaseModel):
    response: str
    sources: List[ChatSource]
    persona_id: str
    reasoning: str | None = Field(default=None, description="Optional model reasoning stream when supported.")


def build_chat_stream_context(request: ChatMessageRequest) -> ChatStreamContext:
    """Validate request, load persona prompt, and build messages (shared by JSON and SSE endpoints)."""
    try:
        persona_uuid = UUID(request.persona_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid persona_id format: {e}",
        ) from e

    with get_session() as session:
        persona = session.get(Persona, persona_uuid)
        if not persona:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Persona not found: {request.persona_id}",
            )
        prompt_row = session.scalar(
            select(PersonaPrompt)
            .where(PersonaPrompt.persona_id == persona_uuid)
            .order_by(PersonaPrompt.created_at.desc())
            .limit(1)
        )
        base_system_prompt = None
        if prompt_row is not None:
            base_system_prompt = (getattr(prompt_row, "system_prompt", None) or getattr(prompt_row, "systemPrompt", None)) or ""
            base_system_prompt = (base_system_prompt or "").strip()
            logger.info(
                "chat.stream.prompt.loaded_from_db",
                persona_id=request.persona_id,
                prompt_length=len(base_system_prompt),
                template_version=getattr(prompt_row, "template_version", None) or getattr(prompt_row, "templateVersion", None),
            )

    if not base_system_prompt:
        base_system_prompt = (get_persona_prompt(request.persona_id) or "").strip()
        logger.info("chat.stream.prompt.using_fallback", persona_id=request.persona_id, prompt_length=len(base_system_prompt or ""))

    if not base_system_prompt:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Persona prompt not found",
        )

    persona_segment: str | None = persona.segment if persona and persona.segment else None
    use_tools = settings.chat_use_tools
    tools = None
    if use_tools:
        from ..agents.tools import KNOWLEDGE_TOOLS

        tools = KNOWLEDGE_TOOLS
        logger.info(
            "chat.tools.enabled",
            persona_id=request.persona_id,
            tools_count=len(tools),
            persona_segment=persona_segment,
        )
    else:
        logger.info("chat.tools.disabled", persona_id=request.persona_id, using_legacy_retrieval=True)

    if request.messages:
        anthropic_messages: List[Dict[str, Any]] = []
        system_parts = [base_system_prompt]

        logger.info(
            "chat.request.received",
            messages_count=len(request.messages),
            has_image_ids=any(msg.image_ids and len(msg.image_ids) > 0 for msg in request.messages),
        )

        for msg in request.messages:
            if msg.role == "system":
                system_parts.append(msg.content)
            elif msg.role in ["user", "assistant"]:
                logger.info(
                    "chat.message.raw",
                    role=msg.role,
                    has_image_ids=bool(msg.image_ids and len(msg.image_ids) > 0),
                    image_id_count=len(msg.image_ids) if msg.image_ids else 0,
                    content_length=len(msg.content) if msg.content else 0,
                )
                anthropic_message = convert_message_with_images(msg)
                if msg.image_ids and len(msg.image_ids) > 0:
                    logger.info(
                        "chat.message.with_images",
                        role=msg.role,
                        image_id_count=len(msg.image_ids),
                        has_text=bool(msg.content),
                        content_type=type(anthropic_message.get("content")).__name__,
                        content_is_list=isinstance(anthropic_message.get("content"), list),
                    )
                anthropic_messages.append(anthropic_message)

        system_prompt = "\n\n".join(system_parts)
        user_msgs = [m.content for m in request.messages if m.role == "user"]
        user_message_for_logging = user_msgs[-1][:100] if user_msgs else "N/A"
        retrieval_query = user_msgs[-1] if user_msgs else user_message_for_logging

        if not anthropic_messages:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one user or assistant message must be provided",
            )
    elif request.message:
        system_prompt = base_system_prompt
        anthropic_messages = [
            {
                "role": "user",
                "content": request.message,
            }
        ]
        user_message_for_logging = request.message[:100]
        retrieval_query = request.message
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either 'message' or 'messages' must be provided",
        )

    if not retrieval_query or retrieval_query == "N/A":
        retrieval_query = ""

    logger.info(
        "chat.message.stream.received",
        persona_id=request.persona_id,
        message_length=len(user_message_for_logging),
    )

    if request.messages:
        last_u, prev_u = extract_last_two_user_texts(anthropic_messages)
    else:
        last_u, prev_u = (retrieval_query or "").strip(), None

    naturalness = build_turn_naturalness_spec(
        last_user_text=last_u,
        prev_user_text=prev_u,
        session=None,
    )

    return ChatStreamContext(
        persona_id=request.persona_id,
        user_id=request.user_id,
        system_prompt=system_prompt,
        anthropic_messages=anthropic_messages,
        retrieval_query=retrieval_query,
        user_message_for_logging=user_message_for_logging,
        persona_segment=persona_segment,
        use_tools=use_tools,
        tools=tools,
        reply_mode=naturalness.reply_mode,
        turn_naturalness_addendum=naturalness.system_addendum_de,
    )


async def collect_chat_message_response(ctx: ChatStreamContext) -> ChatMessageResponse:
    """Consume the SSE pipeline and return a single JSON payload (same text and sources as streaming clients)."""
    full_text = ""
    full_reasoning = ""
    latest_sources: List[Dict[str, Any]] = []
    stream_err: str | None = None

    async for sse_chunk in iter_chat_sse(ctx):
        for block in sse_chunk.strip().split("\n\n"):
            line = block.strip()
            if not line.startswith("data: "):
                continue
            try:
                payload = json.loads(line[6:])
            except json.JSONDecodeError:
                continue
            t = payload.get("type")
            if t == "delta" and payload.get("delta"):
                full_text += payload["delta"]
            elif t == "reasoning_delta" and payload.get("delta"):
                full_reasoning += payload["delta"]
            elif t == "sources":
                latest_sources = payload.get("sources") or []
            elif t == "error":
                stream_err = str(payload.get("error") or "Unknown error")
                break
        if stream_err:
            break

    if stream_err:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=stream_err)

    chat_sources = [
        ChatSource(
            chunk_id=str(source.get("chunk_id", "")),
            document_id=str(source.get("document_id", "")),
            title=str(source.get("title") or "Research"),
            confidence=float(source.get("confidence", 0.8)),
            excerpt=str(source.get("excerpt", source.get("content", "")))[:320],
        )
        for source in latest_sources
        if isinstance(source, dict)
    ]

    return ChatMessageResponse(
        response=full_text,
        sources=chat_sources,
        persona_id=ctx.persona_id,
        reasoning=full_reasoning.strip() or None,
    )


@router.post("/message", response_model=ChatMessageResponse, status_code=status.HTTP_200_OK)
async def send_message(request: ChatMessageRequest, _: None = Depends(verify_request_token)) -> ChatMessageResponse:
    """Send a message to a persona and get a response (buffered; same pipeline as /message/stream)."""
    try:
        ctx = build_chat_stream_context(request)
        return await collect_chat_message_response(ctx)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(
            "chat.message.endpoint.error",
            persona_id=getattr(request, "persona_id", None),
            error=str(e),
            error_type=type(e).__name__,
        )
        raise exception_to_http(e, "Chat") from e


@router.post("/message/stream")
async def send_message_stream(request: ChatMessageRequest, _: None = Depends(verify_request_token)) -> StreamingResponse:
    """Send a message to a persona and stream the response (same generation path as POST /message)."""
    logger.info(
        "chat.stream.endpoint.called",
        persona_id=request.persona_id,
        has_messages=bool(request.messages),
        messages_count=len(request.messages) if request.messages else 0,
        has_message=bool(request.message),
    )

    if request.messages:
        for idx, msg in enumerate(request.messages):
            try:
                has_image_ids = bool(msg.image_ids and len(msg.image_ids) > 0)
                image_id_count = len(msg.image_ids) if msg.image_ids else 0
                logger.info(
                    "chat.stream.message.detail",
                    index=idx,
                    role=msg.role,
                    has_image_ids=has_image_ids,
                    image_id_count=image_id_count,
                    content_preview=msg.content[:50] if msg.content else "",
                )
            except Exception as e:
                logger.error(
                    "chat.stream.message.detail.error",
                    index=idx,
                    error=str(e),
                    error_type=type(e).__name__,
                )

    try:
        ctx = build_chat_stream_context(request)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "chat.stream.endpoint.error",
            error=str(e),
            error_type=type(e).__name__,
            exc_info=True,
        )
        raise exception_to_http(e, "Chat stream") from e

    return StreamingResponse(
        iter_chat_sse(ctx),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "X-Content-Type-Options": "nosniff",
        },
    )
