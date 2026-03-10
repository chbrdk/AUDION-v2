from __future__ import annotations

import asyncio
import base64
import json
import queue
import threading
from typing import AsyncIterator, List, Dict, Any
from uuid import UUID

import structlog
from fastapi import APIRouter, File, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import select

from ..core.config import get_settings
from ..db import get_session
from ..models import Persona, PersonaPrompt
from ..services.usage_report import report_usage
from ..services.voice import ElevenLabsVoiceError, get_voice_client
from ..services.whisper import WhisperTranscriptionService
from ..utils.text import clean_response_text
from ..ws.chat import get_persona_agent, get_persona_prompt, get_retrieval_agent

router = APIRouter(prefix="/voice", tags=["voice"])
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


def convert_message_with_images(msg: VoiceChatMessage) -> Dict[str, Any]:
    """
    Konvertiert eine Message mit Bildern in OpenAI Vision Format.
    Siehe chat.py für Details.
    """
    if not msg.images or len(msg.images) == 0:
        return {
            "role": msg.role,
            "content": msg.content
        }
    
    content_blocks = []
    
    if msg.content and msg.content.strip():
        content_blocks.append({
            "type": "text",
            "text": msg.content
        })
    
    for image_data_url in msg.images:
        if image_data_url.startswith("data:image/"):
            # OpenAI Format: data URL direkt verwenden
            content_blocks.append({
                "type": "image_url",
                "image_url": {
                    "url": image_data_url
                }
            })
    
    if not content_blocks or all(block.get("type") == "image_url" for block in content_blocks):
        content_blocks.insert(0, {
            "type": "text",
            "text": msg.content if msg.content else ""
        })
    
    return {
        "role": msg.role,
        "content": content_blocks
    }

# Initialize Whisper service (lazy-loaded)
_whisper_service: WhisperTranscriptionService | None = None


def get_whisper_service() -> WhisperTranscriptionService:
    """Get or create Whisper transcription service."""
    global _whisper_service
    if _whisper_service is None:
        _whisper_service = WhisperTranscriptionService(
            model_size="base",  # Use 'base' for faster processing, 'small' or 'medium' for better accuracy
            device="cpu",
            compute_type="int8"
        )
    return _whisper_service


class VoiceChatMessage(BaseModel):
    role: str  # "system", "user", "assistant"
    content: str
    images: List[str] | None = Field(default=None)  # Base64 data URLs for images


class VoiceChatRequest(BaseModel):
    persona_id: str
    message: str | None = Field(default=None)  # Legacy: single message string
    messages: List[VoiceChatMessage] | None = Field(default=None)  # New: messages array with conversation history
    voice_id: str | None = Field(default=None)
    user_id: str | None = Field(default=None, description="PLEXON user id for usage tracking")
    
    @model_validator(mode='after')
    def validate_message_or_messages(self):
        """Ensure either message or messages is provided."""
        if not self.message and not self.messages:
            raise ValueError("Either 'message' or 'messages' must be provided")
        return self


def _find_sentence_boundary(text: str) -> int:
    for idx, char in enumerate(text):
        if char in ".!?":
            return idx
        if char == "\n":
            return idx
    return -1


@router.post("/chat/stream")
async def voice_chat_stream(request: VoiceChatRequest) -> StreamingResponse:
    """Stream persona response along with synchronized voice audio."""
    try:
        persona_uuid = UUID(request.persona_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid persona_id format: {exc}"
        ) from exc

    with get_session() as session:
        persona = session.get(Persona, persona_uuid)
        if not persona:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Persona not found: {request.persona_id}"
            )
        prompt = session.scalar(select(PersonaPrompt).where(PersonaPrompt.persona_id == persona_uuid))

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
                # Konvertiere Message mit Bildern in OpenAI Vision Format
                anthropic_message = convert_message_with_images(msg)
                anthropic_messages.append(anthropic_message)
        
        system_prompt = "\n\n".join(system_parts)
        retrieval_query = next((m.content for m in request.messages if m.role == "user"), "")
    elif request.message:
        # Legacy format: single message string
        system_prompt = base_system_prompt
        anthropic_messages = [{
            "role": "user",
            "content": (
                "Answer succinctly in natural, conversational language. "
                "Avoid repeating words or phrases, and do not include document IDs or brackets. "
                "Keep the reply under 90 words and limit to short paragraphs. "
                "Avoid meta commentary and markdown unless explicitly requested. "
                f"User message: {request.message}"
            ),
        }]
        retrieval_query = request.message
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either 'message' or 'messages' must be provided"
        )

    try:
        voice_client = get_voice_client()
    except ElevenLabsVoiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc)
        ) from exc

    async def generate_voice_stream() -> AsyncIterator[str]:
        try:
            logger.info("voice.stream.retrieval.starting", persona_id=request.persona_id)
            loop = asyncio.get_event_loop()
            
            # Try to get sources with a timeout (30 seconds max); fallback to empty on any error
            try:
                _, hits = await asyncio.wait_for(
                    loop.run_in_executor(
                        None,
                        lambda: get_retrieval_agent().run(query=retrieval_query, persona_segment=None)
                    ),
                    timeout=30.0
                )
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
                yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"
            except asyncio.TimeoutError:
                logger.warning("voice.stream.retrieval.timeout", persona_id=request.persona_id)
                yield f"data: {json.dumps({'type': 'sources', 'sources': []})}\n\n"
            except Exception as e:
                logger.warning(
                    "voice.stream.retrieval.failed",
                    persona_id=request.persona_id,
                    error=str(e),
                    message="Continuing without sources (e.g. FlagEmbedding/transformers)."
                )
                yield f"data: {json.dumps({'type': 'sources', 'sources': []})}\n\n"

            logger.info("voice.stream.persona_agent.starting", persona_id=request.persona_id)
            persona_agent = get_persona_agent()

            sentinel = object()
            stream_data_queue: queue.Queue[object] = queue.Queue()
            stream_error = [None]

            def collect_stream_deltas() -> None:
                try:
                    # Convert messages to OpenAI format
                    openai_messages = [
                        {"role": "system", "content": system_prompt}
                    ]
                    for msg in anthropic_messages:
                        openai_messages.append({
                            "role": msg.get("role", "user"),
                            "content": msg.get("content", "")
                        })
                    
                    stream = persona_agent._openai.chat.completions.create(
                        model=settings.chat_model,
                        max_completion_tokens=600,
                        messages=openai_messages,
                        stream=True,
                    )
                    
                    for chunk in stream:
                        if chunk.choices and len(chunk.choices) > 0:
                            delta = chunk.choices[0].delta
                            if delta and delta.content:
                                stream_data_queue.put(delta.content)
                except Exception as exc:
                    stream_error[0] = exc
                finally:
                    stream_data_queue.put(sentinel)

            thread = threading.Thread(target=collect_stream_deltas, daemon=True)
            thread.start()

            response_buffer = ""
            sanitized_sent = ""
            pending_text = ""

            def append_new_text(delta_text: str) -> str:
                nonlocal response_buffer, sanitized_sent
                response_buffer += delta_text
                sanitized = clean_response_text(response_buffer)
                max_len = min(len(sanitized), len(sanitized_sent))
                prefix_len = 0
                while prefix_len < max_len and sanitized[prefix_len] == sanitized_sent[prefix_len]:
                    prefix_len += 1
                new_portion = sanitized[prefix_len:]
                sanitized_sent = sanitized
                return new_portion

            async def flush_chunks(force: bool = False) -> AsyncIterator[str]:
                nonlocal pending_text
                while True:
                    boundary_idx = _find_sentence_boundary(pending_text)
                    if boundary_idx == -1:
                        if not force or not pending_text.strip():
                            return
                        chunk_text = pending_text.strip()
                        pending_text = ""
                    else:
                        chunk_text = pending_text[: boundary_idx + 1].strip()
                        pending_text = pending_text[boundary_idx + 1 :].lstrip()
                    if not chunk_text:
                        continue
                    audio_bytes = await voice_client.synthesize(chunk_text, request.voice_id)
                    audio_b64 = base64.b64encode(audio_bytes).decode("ascii")
                    payload = {
                        "type": "delta",
                        "delta": chunk_text,
                        "audio": audio_b64,
                        "mime_type": "audio/mpeg"
                    }
                    yield f"data: {json.dumps(payload)}\n\n"

            def get_item_with_timeout() -> object | None:
                try:
                    return stream_data_queue.get(timeout=0.1)
                except queue.Empty:
                    return None

            while True:
                item = await loop.run_in_executor(None, get_item_with_timeout)
                if item is None:
                    if not thread.is_alive():
                        break
                    await asyncio.sleep(0.01)
                    continue

                if item is sentinel:
                    if stream_error[0]:
                        raise stream_error[0]
                    break

                pending_text += append_new_text(item)
                async for chunk_event in flush_chunks():
                    yield chunk_event

            thread.join(timeout=1)
            async for chunk_event in flush_chunks(force=True):
                yield chunk_event

            yield f"data: {json.dumps({'type': 'complete'})}\n\n"
            if request.user_id:
                report_usage(
                    user_id=request.user_id,
                    event_type="chat_message",
                    raw_units={"runs": 1},
                )
        except Exception as exc:
            logger.error("voice.stream.error", error=str(exc), exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'error': str(exc)})}\n\n"

    return StreamingResponse(
        generate_voice_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


class TranscriptionResponse(BaseModel):
    text: str
    language: str | None = None
    language_probability: float | None = None


@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(
    audio: UploadFile = File(...),
    language: str | None = None
) -> TranscriptionResponse:
    """
    Transcribe audio file to text using Whisper.
    
    Args:
        audio: Audio file (WAV, MP3, M4A, etc.)
        language: Optional language code (e.g., 'en', 'de'). If None, auto-detect.
    
    Returns:
        Transcribed text with language information
    """
    try:
        logger.info("transcription.request", filename=audio.filename, language=language)
        
        # Read audio data
        audio_data = await audio.read()
        if not audio_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Empty audio file"
            )
        
        logger.info("transcription.audio.received", size_bytes=len(audio_data))
        
        # Get Whisper service
        whisper_service = get_whisper_service()
        
        # Run transcription in executor to avoid blocking
        loop = asyncio.get_event_loop()
        transcript, detected_language, language_prob = await loop.run_in_executor(
            None,
            lambda: whisper_service.transcribe(audio_data, language=language)
        )
        
        logger.info(
            "transcription.complete", 
            text_length=len(transcript),
            detected_language=detected_language,
            language_probability=language_prob
        )
        
        return TranscriptionResponse(
            text=transcript,
            language=detected_language,
            language_probability=language_prob
        )
        
    except Exception as exc:
        logger.error("transcription.error", error=str(exc), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Transcription failed: {str(exc)}"
        ) from exc


