from __future__ import annotations

import asyncio
import json
from typing import AsyncIterator, List
from uuid import UUID

import structlog
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select

from ..agents.persona import PersonaAgent
from ..agents.retrieval import RetrievalAgent
from ..db import get_session
from ..models import Persona, PersonaPrompt
from ..utils.text import clean_response_text
from ..ws.chat import get_persona_agent, get_persona_prompt, get_retrieval_agent

router = APIRouter(prefix="/chat", tags=["chat"])
logger = structlog.get_logger(__name__)


class ChatMessageRequest(BaseModel):
    persona_id: str
    message: str


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
    
    system_prompt = prompt.system_prompt if prompt else get_persona_prompt(request.persona_id)
    if not system_prompt:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Persona prompt not found"
        )
    
    logger.info("chat.message.received", persona_id=request.persona_id, message_length=len(request.message))
    
    # Get relevant sources
    try:
        logger.info("chat.retrieval.starting", query=request.message[:100])
        loop = asyncio.get_event_loop()
        embedding, hits = await loop.run_in_executor(
            None,
            lambda: get_retrieval_agent().run(query=request.message, persona_segment=None)
        )
        logger.info("chat.retrieval.complete", hits_count=len(hits))
    except Exception as e:
        logger.error("chat.retrieval.failed", error=str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve sources: {str(e)}"
        ) from e
    
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
        
        def generate_response() -> str:
            """Generate response synchronously using Anthropic API."""
            # Use create instead of stream for simpler REST API response
            response = persona_agent._anthropic.messages.create(
                model="claude-3-5-haiku-20241022",
                max_tokens=600,
                temperature=0.4,
                system=system_prompt,
                messages=[
                    {
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
                    }
                ],
            )
            
            # Extract text content
            if response.content and len(response.content) > 0:
                text_content = response.content[0].text if hasattr(response.content[0], 'text') else str(response.content[0])
                return text_content
            return ""
        
        # Run in executor to avoid blocking
        loop = asyncio.get_event_loop()
        response_text = await loop.run_in_executor(None, generate_response)
        
        response_text = clean_response_text(response_text)
        logger.info("chat.persona_agent.complete", response_length=len(response_text))
        
    except Exception as e:
        logger.error("chat.persona_agent.failed", error=str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate response: {str(e)}"
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
    
    system_prompt = prompt.system_prompt if prompt else get_persona_prompt(request.persona_id)
    if not system_prompt:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Persona prompt not found"
        )
    
    logger.info("chat.message.stream.received", persona_id=request.persona_id, message_length=len(request.message))
    
    async def generate_stream() -> AsyncIterator[str]:
        """Generate and stream response chunks."""
        try:
            # Start retrieval in background and persona agent in parallel
            logger.info("chat.stream.retrieval.starting", query=request.message[:100])
            loop = asyncio.get_event_loop()
            
            # Start retrieval task in background (non-blocking)
            retrieval_task = asyncio.create_task(
                asyncio.wait_for(
                    loop.run_in_executor(
                        None,
                        lambda: get_retrieval_agent().run(query=request.message, persona_segment=None)
                    ),
                    timeout=10.0  # Reduced timeout to 10 seconds
                )
            )
            
            # Send empty sources immediately to unblock frontend
            yield f"data: {json.dumps({'type': 'sources', 'sources': []})}\n\n"
            
            # Start persona agent immediately (don't wait for retrieval)
            logger.info("chat.stream.persona_agent.starting", persona_id=request.persona_id)
            persona_agent = get_persona_agent()
            
            # Create stream using asyncio to bridge sync stream to async
            import queue
            import threading
            
            sentinel = object()
            delta_queue: queue.Queue[object] = queue.Queue()
            stream_error = [None]  # Use list to pass exception from thread
            
            def collect_stream_deltas():
                """Collect deltas from stream in a separate thread."""
                try:
                    with persona_agent._anthropic.messages.stream(
                        model="claude-3-5-haiku-20241022",
                        max_tokens=600,
                        temperature=0.4,
                        system=system_prompt,
                        messages=[
                            {
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
                            }
                        ],
                    ) as stream:
                        for event in stream:
                            if event.type == "content_block_delta":
                                delta_text = getattr(event.delta, "text", None)
                                if delta_text is None and isinstance(event.delta, dict):
                                    delta_text = event.delta.get("text")
                                if delta_text:
                                    delta_queue.put(delta_text)
                except Exception as e:
                    logger.error("chat.stream.collect_failed", error=str(e), exc_info=True)
                    stream_error[0] = e
                finally:
                    # Signal completion
                    delta_queue.put(sentinel)
            
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
            def get_item_with_timeout():
                """Get next queue item with timeout, returning None on timeout."""
                try:
                    return delta_queue.get(timeout=0.1)
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
                                item = delta_queue.get_nowait()
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

