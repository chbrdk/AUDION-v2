from __future__ import annotations

import asyncio
import json
from typing import AsyncIterator, List, Dict, Any
from uuid import UUID

import structlog
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import select

from ..core.config import get_settings
from ..db import get_session
from ..models import Persona, PersonaPrompt
from ..utils.text import clean_response_text
from ..ws.chat import get_persona_agent, get_persona_prompt, get_retrieval_agent
from ..services.usage_report import report_usage
from .images import get_image_data_url
from msqdx_glass_proto import ContentDeltaEvent, SourcesEvent, CompleteEvent, ThinkingEvent

router = APIRouter(prefix="/chat", tags=["chat"])
logger = structlog.get_logger(__name__)
settings = get_settings()


def select_model_for_messages(messages: List[Dict[str, Any]]) -> str:
    """
    Wählt das passende Modell basierend auf dem Inhalt der Messages.
    - Haiku 4.5 für normale Text-Messages (kostengünstig, schnell)
    - Sonnet 4.5 für Messages mit Bildern (Vision-Unterstützung, bessere Performance)
    """
    # Prüfe ob Bilder in den Messages vorhanden sind
    has_images = any(
        isinstance(msg.get("content"), list) and 
        any(block.get("type") == "image" for block in msg.get("content", []))
        for msg in messages
    )
    
    if has_images:
        # Sonnet 4.5 für Vision (unterstützt Bilder, bessere Performance)
        return "claude-sonnet-4-5-20250929"
    else:
        # Haiku 4.5 für normale Messages (kostengünstig, schnell)
        return "claude-haiku-4-5-20251001"


def convert_message_with_images(msg: ChatMessage) -> Dict[str, Any]:
    """
    Konvertiert eine Message mit Bildern (via Image-IDs) in OpenAI Vision Format.
    
    OpenAI Vision erwartet Messages im Format:
    {
        "role": "user",
        "content": [
            {"type": "text", "text": "..."},
            {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,..."}}
        ]
    }
    """
    # Prüfe ob Image-IDs vorhanden sind
    if not msg.image_ids or len(msg.image_ids) == 0:
        # Normale Text-Message ohne Bilder
        return {
            "role": msg.role,
            "content": msg.content
        }
    
    logger.info("chat.image.processing",
               role=msg.role,
               image_count=len(msg.image_ids))
    
    # Message mit Bildern: content als Array
    content_blocks = []
    
    # Text-Block hinzufügen (wenn vorhanden)
    if msg.content and msg.content.strip():
        content_blocks.append({
            "type": "text",
            "text": msg.content
        })
    
    # Bild-Blöcke hinzufügen (lade Bilder anhand der IDs)
    for idx, image_id in enumerate(msg.image_ids):
        image_data_url = get_image_data_url(image_id)
        
        if not image_data_url:
            logger.warning("chat.image.not_found",
                         image_id=image_id,
                         image_index=idx)
            continue
        
        # OpenAI Format: data URL direkt verwenden (nicht base64 extrahieren)
        if image_data_url.startswith("data:image/"):
            logger.info("chat.image.loaded",
                       image_index=idx,
                       image_id=image_id,
                       data_url_length=len(image_data_url))
            
            content_blocks.append({
                "type": "image_url",
                "image_url": {
                    "url": image_data_url
                }
            })
        else:
            logger.warning("chat.image.invalid_data_url",
                         image_id=image_id,
                         image_index=idx)
    
    # Wenn nur Bilder und kein Text, füge leeren Text-Block hinzu
    if not content_blocks or all(block.get("type") == "image_url" for block in content_blocks):
        content_blocks.insert(0, {
            "type": "text",
            "text": msg.content if msg.content else ""
        })
    
    logger.info("chat.image.conversion_complete",
               role=msg.role,
               total_blocks=len(content_blocks),
               text_blocks=sum(1 for b in content_blocks if b.get("type") == "text"),
               image_blocks=sum(1 for b in content_blocks if b.get("type") == "image_url"))
    
    return {
        "role": msg.role,
        "content": content_blocks
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

    @model_validator(mode='after')
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


@router.post("/message", response_model=ChatMessageResponse, status_code=status.HTTP_200_OK)
async def send_message(request: ChatMessageRequest) -> ChatMessageResponse:
    """Send a message to a persona and get a response."""
    try:
        return await _send_message_impl(request)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(
            "chat.message.endpoint.error",
            persona_id=getattr(request, "persona_id", None),
            error=str(e),
            error_type=type(e).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Chat error: {type(e).__name__}: {str(e)}",
        ) from e


async def _send_message_impl(request: ChatMessageRequest) -> ChatMessageResponse:
    """Implementation of send_message to allow top-level error handling."""
    try:
        persona_uuid = UUID(request.persona_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid persona_id format: {e}"
        ) from e
    
    # Get persona from database
    with get_session() as session:
        persona = session.get(Persona, persona_uuid)
        if not persona:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Persona not found: {request.persona_id}"
            )
        
        # Get persona prompt
        prompt = session.scalar(
            select(PersonaPrompt).where(PersonaPrompt.persona_id == persona_uuid)
        )
    
    # Determine system prompt and messages
    base_system_prompt = prompt.system_prompt if prompt else get_persona_prompt(request.persona_id)
    if not base_system_prompt:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Persona prompt not found"
        )
    
    # Build messages array from request
    if request.messages:
        # New format: messages array provided
        anthropic_messages = []
        system_parts = [base_system_prompt]
        
        # Debug: Log incoming request
        logger.info("chat.request.received",
                   messages_count=len(request.messages),
                   has_image_ids=any(msg.image_ids and len(msg.image_ids) > 0 for msg in request.messages))
        
        for msg in request.messages:
            if msg.role == "system":
                system_parts.append(msg.content)
            elif msg.role in ["user", "assistant"]:
                # Debug: Log raw message before conversion
                logger.info("chat.message.raw",
                           role=msg.role,
                           has_image_ids=bool(msg.image_ids and len(msg.image_ids) > 0),
                           image_id_count=len(msg.image_ids) if msg.image_ids else 0,
                           content_length=len(msg.content) if msg.content else 0)
                
                # Konvertiere Message mit Bildern (via Image-IDs) in OpenAI Vision Format
                anthropic_message = convert_message_with_images(msg)
                
                # Debug: Log wenn Bilder vorhanden sind
                if msg.image_ids and len(msg.image_ids) > 0:
                    logger.info("chat.message.with_images", 
                               role=msg.role,
                               image_id_count=len(msg.image_ids),
                               has_text=bool(msg.content),
                               content_type=type(anthropic_message.get("content")).__name__,
                               content_is_list=isinstance(anthropic_message.get("content"), list))
                
                anthropic_messages.append(anthropic_message)
        
        system_prompt = "\n\n".join(system_parts)
        def _first_user_text(msgs):
            for m in msgs:
                if m.role != "user":
                    continue
                c = m.content
                if isinstance(c, str):
                    return c[:100] if c else ""
                if isinstance(c, list):
                    for block in c:
                        if isinstance(block, dict) and block.get("type") == "text":
                            t = block.get("text", "")
                            return (t[:100] if t else "") if isinstance(t, str) else ""
                break
            return ""
        retrieval_query = _first_user_text(request.messages)
        user_message_for_logging = retrieval_query or "(no text)"
        
        # Union logging removed - Audion is now autonomous
    elif request.message:
        # Legacy format: single message string
        system_prompt = base_system_prompt
        anthropic_messages = [{
            "role": "user",
            "content": (
                "Answer succinctly in natural, conversational language. "
                "Avoid repeating words or phrases, do not include document IDs, chunk IDs, brackets, or the word 'doc'. "
                "Keep the reply to at most three short paragraphs, unless the user explicitly asks for more detail. "
                "Share only the most relevant details, and go deeper only when it truly adds value. "
                "Avoid repeating words or phrases, do not include document IDs, chunk IDs, brackets, or the word 'doc'. "
                "Keep the reply to at most three short paragraphs, unless the user explicitly asks for more detail. "
                "Share only the most relevant details, and go deeper only when it truly adds value. "
                f"User message: {request.message}"
            ),
        }]
        retrieval_query = request.message
        user_message_for_logging = request.message
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either 'message' or 'messages' must be provided"
        )
    
    logger.info("chat.message.received", persona_id=request.persona_id, message_length=len(user_message_for_logging))
    
    # Get relevant sources (graceful fallback if FlagEmbedding/transformers incompatible)
    try:
        logger.info("chat.retrieval.starting", query=retrieval_query[:100])
        loop = asyncio.get_event_loop()
        embedding, hits = await loop.run_in_executor(
            None,
            lambda: get_retrieval_agent().run(query=retrieval_query, persona_segment=None)
        )
        logger.info("chat.retrieval.complete", hits_count=len(hits))
    except Exception as e:
        logger.warning(
            "chat.retrieval.failed",
            error=str(e),
            exc_info=True,
            message="Continuing without sources (e.g. FlagEmbedding/transformers compatibility)."
        )
        embedding = []
        hits = []

    # Convert hits to source format
    sources = [
        {
            "chunk_id": str(hit.payload.get("chunk_id", "")),
            "document_id": str(hit.payload.get("document_id", "")),
            "content": hit.payload.get("content", ""),
            "confidence": float(hit.score) if hasattr(hit, "score") else 0.8,
        }
        for hit in hits[:5]
        if hit.payload
    ]
    
    logger.info("chat.sources.prepared", sources_count=len(sources))
    
    # Generate response using persona agent
    try:
        logger.info("chat.persona_agent.starting", persona_id=request.persona_id)
        
        # Get persona agent
        persona_agent = get_persona_agent()
        
        response_holder: list = []  # Mutable container to get usage from sync callback

        def generate_response() -> str:
            """Generate response synchronously using OpenAI API."""
            openai_messages = [
                {"role": "system", "content": system_prompt}
            ]
            for msg in anthropic_messages:
                openai_messages.append({
                    "role": msg.get("role", "user"),
                    "content": msg.get("content", ""),
                })
            response = persona_agent._openai.chat.completions.create(
                model=settings.chat_model,
                max_completion_tokens=600,
                messages=openai_messages,
            )
            response_holder.append(response)
            if response.choices and len(response.choices) > 0:
                return response.choices[0].message.content or ""
            return ""

        loop = asyncio.get_event_loop()
        response_text = await loop.run_in_executor(None, generate_response)

        if request.user_id and response_holder:
            resp = response_holder[0]
            usage = getattr(resp, "usage", None)
            if usage:
                report_usage(
                    user_id=request.user_id,
                    event_type="llm_request",
                    raw_units={
                        "input_tokens": getattr(usage, "prompt_tokens", None),
                        "output_tokens": getattr(usage, "completion_tokens", None),
                    },
                )
            else:
                report_usage(
                    user_id=request.user_id,
                    event_type="chat_message",
                    raw_units={"runs": 1},
                )

        response_text = clean_response_text(response_text if response_text is not None else "")
        logger.info("chat.persona_agent.complete", response_length=len(response_text))
        
    except HTTPException:
        raise
    except Exception as e:
        err_msg = str(e)
        err_type = type(e).__name__
        logger.error(
            "chat.persona_agent.failed",
            error=err_msg,
            error_type=err_type,
            persona_id=request.persona_id,
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate response: {err_type}: {err_msg}"
        ) from e
    
    # Format sources for response
    chat_sources = [
        ChatSource(
            chunk_id=source["chunk_id"],
            document_id=source["document_id"],
            title="Research",  # TODO: Get from document metadata
            confidence=source["confidence"],
            excerpt=source["content"][:320]
        )
        for source in sources
    ]
    
    return ChatMessageResponse(
        response=response_text,
        sources=chat_sources,
        persona_id=request.persona_id
    )


@router.post("/message/stream")
async def send_message_stream(request: ChatMessageRequest) -> StreamingResponse:
    """Send a message to a persona and stream the response."""
    # Log immediately at function start - before any try/except
    # Use both structlog and print to ensure visibility
    import sys
    print(f"[ENDPOINT] Function called - persona_id: {request.persona_id}", file=sys.stderr, flush=True)
    print(f"[ENDPOINT] has_messages: {bool(request.messages)}, count: {len(request.messages) if request.messages else 0}", file=sys.stderr, flush=True)
    
    logger.info("chat.stream.endpoint.called",
               persona_id=request.persona_id,
               has_messages=bool(request.messages),
               messages_count=len(request.messages) if request.messages else 0,
               has_message=bool(request.message))
    
    try:
        
        if request.messages:
            for idx, msg in enumerate(request.messages):
                try:
                    # Check if image_ids attribute exists and has value
                    has_image_ids = bool(msg.image_ids and len(msg.image_ids) > 0)
                    image_id_count = len(msg.image_ids) if msg.image_ids else 0
                    
                    logger.info("chat.stream.message.detail",
                               index=idx,
                               role=msg.role,
                               has_image_ids=has_image_ids,
                               image_id_count=image_id_count,
                               content_preview=msg.content[:50] if msg.content else "")
                except Exception as e:
                    logger.error("chat.stream.message.detail.error",
                               index=idx,
                               error=str(e),
                               error_type=type(e).__name__)
    except Exception as e:
        logger.error("chat.stream.endpoint.error",
                   error=str(e),
                   error_type=type(e).__name__,
                   exc_info=True)
    
    try:
        persona_uuid = UUID(request.persona_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid persona_id format: {e}"
        ) from e
    
    # Get persona from database
    with get_session() as session:
        persona = session.get(Persona, persona_uuid)
        if not persona:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Persona not found: {request.persona_id}"
            )
        
        # Get persona prompt
        prompt = session.scalar(
            select(PersonaPrompt).where(PersonaPrompt.persona_id == persona_uuid)
        )
    
    # Extract persona segment for tool filtering
    persona_segment: str | None = persona.segment if persona and persona.segment else None
    
    # Check if tools are enabled via feature flag
    use_tools = settings.chat_use_tools
    
    # Load tools if enabled
    tools = None
    if use_tools:
        from ..agents.tools import KNOWLEDGE_TOOLS
        tools = KNOWLEDGE_TOOLS
        logger.info("chat.tools.enabled", persona_id=request.persona_id, tools_count=len(tools), persona_segment=persona_segment)
    else:
        logger.info("chat.tools.disabled", persona_id=request.persona_id, using_legacy_retrieval=True)
    
    # Determine system prompt and messages
    base_system_prompt = prompt.system_prompt if prompt else get_persona_prompt(request.persona_id)
    if not base_system_prompt:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Persona prompt not found"
        )
    
    # Build messages array from request
    if request.messages:
        # New format: messages array provided
        anthropic_messages = []
        system_parts = [base_system_prompt]
        
        for msg in request.messages:
            if msg.role == "system":
                system_parts.append(msg.content)
            elif msg.role in ["user", "assistant"]:
                # Konvertiere Message mit Bildern (via Image-IDs) in OpenAI Vision Format
                anthropic_message = convert_message_with_images(msg)
                anthropic_messages.append(anthropic_message)
        
        system_prompt = "\n\n".join(system_parts)
        # Get last user message for logging and retrieval
        user_msgs = [m.content for m in request.messages if m.role == "user"]
        user_message_for_logging = user_msgs[-1][:100] if user_msgs else "N/A"
        
        # Union logging removed - Audion is now autonomous
        
        # Ensure we have at least one message
        if not anthropic_messages:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one user or assistant message must be provided"
            )
    elif request.message:
        # Legacy format: single message string
        system_prompt = base_system_prompt
        anthropic_messages = [{
            "role": "user",
            "content": (
                "Answer succinctly in natural, conversational language. "
                "Avoid repeating words or phrases, do not include document IDs, chunk IDs, brackets, or the word 'doc'. "
                "Keep the reply under 90 words and at most three short paragraphs unless the user explicitly asks for more detail. "
                "Do not mention confidence scores, percentages, or meta commentary. "
                "Avoid markdown formatting (no bold, bullets) unless the user requests it. "
                "Share only the most relevant details, and go deeper only when it truly adds value. "
                f"User message: {request.message}"
            ),
        }]
        user_message_for_logging = request.message[:100]
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either 'message' or 'messages' must be provided"
        )
    
    logger.info("chat.message.stream.received", persona_id=request.persona_id, message_length=len(user_message_for_logging))
    
    async def generate_stream() -> AsyncIterator[str]:
        """Generate and stream response chunks."""
        usage_reported = [False]  # Mutable so inner code can set it
        try:
            # Extract query for retrieval (use last user message)
            if request.messages:
                user_msgs = [m.content for m in request.messages if m.role == "user"]
                retrieval_query = user_msgs[-1] if user_msgs else user_message_for_logging
            else:
                retrieval_query = user_message_for_logging
            
            # Ensure retrieval_query is a string
            if not retrieval_query or retrieval_query == "N/A":
                retrieval_query = ""
            
            loop = asyncio.get_event_loop()
            persona_agent = get_persona_agent()
            
            # Use PersonaAgent.stream_response() with tools if enabled, otherwise use direct stream
            if use_tools and tools:
                # Tools-based streaming: Use PersonaAgent with full tool support
                logger.info("chat.stream.tools_enabled", persona_id=request.persona_id, tools_count=len(tools))
                
                # Create event queue for PersonaAgent events
                import queue
                import threading
                
                event_queue: queue.Queue[object] = queue.Queue()
                stream_error = [None]
                
                def send_event(event):
                    """Convert PersonaAgent events to queue items."""
                    logger.debug("chat.stream.event_queued", event_type=type(event).__name__)
                    event_queue.put(event)
                
                # Prepare sources (empty for tools mode, tools handle retrieval dynamically)
                sources = []
                
                # Run PersonaAgent.stream_response() with tools in executor
                def run_persona_stream():
                    try:
                        # Filter out system messages (they're already in system_prompt)
                        user_assistant_messages = [
                            msg for msg in anthropic_messages 
                            if msg.get("role") in ["user", "assistant"]
                        ]
                        persona_agent.stream_response(
                            system_prompt=system_prompt,
                            messages=user_assistant_messages,
                            sources=sources,
                            persona_id=request.persona_id,
                            send_event=send_event,
                            tools=tools,
                            persona_segment=persona_segment,
                            use_tools=True,
                        )
                    except Exception as e:
                        logger.error("chat.stream.persona_agent_failed", error=str(e), exc_info=True)
                        stream_error[0] = e
                    finally:
                        event_queue.put(None)  # Signal completion
                
                # Start PersonaAgent stream in thread
                stream_thread = threading.Thread(target=run_persona_stream, daemon=True)
                stream_thread.start()
                
                # Convert PersonaAgent events to SSE format
                response_buffer = ""
                sanitized_sent = ""
                
                def emit_sanitized_delta(delta_text: str) -> str:
                    nonlocal response_buffer, sanitized_sent
                    response_buffer += delta_text
                    sanitized = clean_response_text(response_buffer)
                    max_len = min(len(sanitized), len(sanitized_sent))
                    prefix_len = 0
                    while prefix_len < max_len and sanitized[prefix_len] == sanitized_sent[prefix_len]:
                        prefix_len += 1
                    delta_payload = sanitized[prefix_len:]
                    sanitized_sent = sanitized
                    return delta_payload
                
                # Process events from PersonaAgent
                logger.info("chat.stream.queue_processing_started", persona_id=request.persona_id)
                while True:
                    try:
                        event = await loop.run_in_executor(
                            None,
                            lambda: event_queue.get(timeout=0.1)
                        )
                        logger.debug("chat.stream.event_received", event_type=type(event).__name__ if event else "None")
                    except queue.Empty:
                        # Check if thread is still alive
                        if not stream_thread.is_alive():
                            # Drain remaining events
                            try:
                                while True:
                                    event = event_queue.get_nowait()
                                    if event is None:
                                        break
                                    # Process event
                                    if isinstance(event, ContentDeltaEvent):
                                        delta_payload = emit_sanitized_delta(event.delta)
                                        if delta_payload:
                                            yield f"data: {json.dumps({'type': 'delta', 'delta': delta_payload})}\n\n"
                                    elif isinstance(event, SourcesEvent):
                                        yield f"data: {json.dumps({'type': 'sources', 'sources': event.sources})}\n\n"
                                    elif isinstance(event, CompleteEvent):
                                        yield f"data: {json.dumps({'type': 'complete'})}\n\n"
                                        if request.user_id and not usage_reported[0]:
                                            usage_reported[0] = True
                                            report_usage(
                                                user_id=request.user_id,
                                                event_type="chat_message",
                                                raw_units={"runs": 1},
                                            )
                                    elif isinstance(event, ThinkingEvent):
                                        # Thinking events are typically not sent to frontend for SSE
                                        pass
                            except queue.Empty:
                                pass
                            if stream_error[0]:
                                raise stream_error[0]
                            break
                        await asyncio.sleep(0.01)
                        continue
                    
                    if event is None:
                        # Stream complete
                        if stream_error[0]:
                            raise stream_error[0]
                        break
                    
                    # Convert PersonaAgent events to SSE format
                    if isinstance(event, ContentDeltaEvent):
                        logger.debug("chat.stream.content_delta_event", delta_length=len(event.delta) if event.delta else 0)
                        delta_payload = emit_sanitized_delta(event.delta)
                        if delta_payload:
                            yield f"data: {json.dumps({'type': 'delta', 'delta': delta_payload})}\n\n"
                    elif isinstance(event, SourcesEvent):
                        yield f"data: {json.dumps({'type': 'sources', 'sources': event.sources})}\n\n"
                    elif isinstance(event, CompleteEvent):
                        yield f"data: {json.dumps({'type': 'complete'})}\n\n"
                        if request.user_id and not usage_reported[0]:
                            usage_reported[0] = True
                            report_usage(
                                user_id=request.user_id,
                                event_type="chat_message",
                                raw_units={"runs": 1},
                            )
                    elif isinstance(event, ThinkingEvent):
                        # Thinking events: send status if it's an error, otherwise ignore
                        if hasattr(event, "status") and event.status and "error" in event.status.lower():
                            # Convert error ThinkingEvent to error SSE
                            error_msg = event.status.replace("Error generating response: ", "")
                            yield f"data: {json.dumps({'type': 'error', 'error': error_msg})}\n\n"
                        # Otherwise ignore thinking events
                        pass
                
                # Wait for thread to complete
                stream_thread.join(timeout=2)
                logger.info("chat.stream.tools_complete", persona_id=request.persona_id)
                
            else:
                # Legacy streaming: Direct Anthropic stream (backward compatibility)
                logger.info("chat.stream.legacy_mode", persona_id=request.persona_id)
                
                # Start retrieval task in background (non-blocking)
                retrieval_task = asyncio.create_task(
                    asyncio.wait_for(
                        loop.run_in_executor(
                            None,
                            lambda: get_retrieval_agent().run(query=retrieval_query, persona_segment=None)
                        ),
                        timeout=10.0
                    )
                )
                
                # Send empty sources immediately to unblock frontend
                yield f"data: {json.dumps({'type': 'sources', 'sources': []})}\n\n"
                
                # Create stream using asyncio to bridge sync stream to async
                import queue
                import threading
                
                sentinel = object()
                # Use container to avoid closure issues
                queue_container = {"queue": queue.Queue()}
                stream_error = [None]  # Use list to pass exception from thread
                
                def collect_stream_deltas():
                    """Collect deltas from stream in a separate thread."""
                    stream_queue = queue_container["queue"]
                    try:
                        # Convert messages to OpenAI format (content can be string or array for images)
                        openai_messages = [
                            {"role": "system", "content": system_prompt}
                        ]
                        for msg in anthropic_messages:
                            openai_messages.append({
                                "role": msg.get("role", "user"),
                                "content": msg.get("content", "")  # Can be string or array (for images)
                            })
                        
                        # Legacy mode: No tools (backward compatibility)
                        stream = persona_agent._openai.chat.completions.create(
                            model="gpt-5-mini",
                            max_completion_tokens=600,
                            messages=openai_messages,
                            stream=True,
                        )
                        
                        for chunk in stream:
                            if chunk.choices and len(chunk.choices) > 0:
                                delta = chunk.choices[0].delta
                                if delta and delta.content:
                                    stream_queue.put(delta.content)
                    except Exception as e:
                        logger.error("chat.stream.collect_failed", error=str(e), exc_info=True)
                        stream_error[0] = e
                    finally:
                        # Signal completion
                        stream_queue.put(sentinel)
                
                response_buffer = ""
                sanitized_sent = ""

                def emit_sanitized_delta(delta_text: str) -> str:
                    nonlocal response_buffer, sanitized_sent
                    response_buffer += delta_text
                    sanitized = clean_response_text(response_buffer)
                    max_len = min(len(sanitized), len(sanitized_sent))
                    prefix_len = 0
                    while prefix_len < max_len and sanitized[prefix_len] == sanitized_sent[prefix_len]:
                        prefix_len += 1
                    delta_payload = sanitized[prefix_len:]
                    sanitized_sent = sanitized
                    return delta_payload

                # Start collecting in a thread (not executor, to keep it simple)
                thread = threading.Thread(target=collect_stream_deltas, daemon=True)
                thread.start()
                
                # Yield deltas from queue as they arrive
                stream_data_queue = queue_container["queue"]
                def get_item_with_timeout():
                    """Get next queue item with timeout, returning None on timeout."""
                    try:
                        return stream_data_queue.get(timeout=0.1)
                    except queue.Empty:
                        return None
                
                while True:
                    # Wait for next item with timeout (non-blocking)
                    item = await loop.run_in_executor(None, get_item_with_timeout)
                    
                    if item is None:
                        # Timeout: check thread status
                        if not thread.is_alive():
                            # Drain any remaining items
                            try:
                                while True:
                                    item = stream_data_queue.get_nowait()
                                    if item is sentinel:
                                        break
                                    delta_payload = emit_sanitized_delta(item)
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
                    
                    delta_payload = emit_sanitized_delta(item)
                    if delta_payload:
                        yield f"data: {json.dumps({'type': 'delta', 'delta': delta_payload})}\n\n"
                
                # Wait for thread to complete
                thread.join(timeout=1)
                
                # Try to get retrieval results if available (non-blocking)
                try:
                    if retrieval_task.done():
                        embedding, hits = retrieval_task.result()
                        logger.info("chat.stream.retrieval.complete", hits_count=len(hits))
                        
                        # Convert hits to source format
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
                        
                        # Send sources if we have any
                        if sources:
                            yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"
                except (asyncio.TimeoutError, asyncio.CancelledError, Exception) as e:
                    logger.warning("chat.stream.retrieval.skipped", error=str(e))
                    # Ignore retrieval errors - sources are optional
                
                # Send completion
                yield f"data: {json.dumps({'type': 'complete'})}\n\n"
                logger.info("chat.stream.persona_agent.complete")
                if request.user_id and not usage_reported[0]:
                    usage_reported[0] = True
                    report_usage(
                        user_id=request.user_id,
                        event_type="chat_message",
                        raw_units={"runs": 1},
                    )
        except Exception as e:
            logger.error("chat.stream.error", error=str(e), exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
    
    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "X-Content-Type-Options": "nosniff",
        }
    )

