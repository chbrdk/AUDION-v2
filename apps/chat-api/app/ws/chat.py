from __future__ import annotations

import asyncio
import json
from typing import List
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from msqdx_glass_proto import PersonasDiscoveredEvent, ThinkingEvent

from ..agents.persona import PersonaAgent
from ..agents.retrieval import RetrievalAgent
from ..db import get_session
from ..models import Persona, PersonaPrompt
from ..deps import verify_websocket_token
from ..services.persona_discovery import PersonaDiscoveryService
from ..services.usage_report import report_retrieval_query_usage, report_usage
from ..utils.turn_naturalness import (
    TurnSessionState,
    build_turn_naturalness_spec,
    extract_last_two_user_texts,
    finalize_turn_session_after_assistant,
)

router = APIRouter()
# Lazy initialization - agents will be created on first use to avoid blocking server startup
_retrieval_agent: RetrievalAgent | None = None
_persona_agent: PersonaAgent | None = None
_persona_discovery: PersonaDiscoveryService | None = None


def get_retrieval_agent() -> RetrievalAgent:
    """Get or create the retrieval agent (lazy initialization)."""
    global _retrieval_agent
    if _retrieval_agent is None:
        _retrieval_agent = RetrievalAgent()
    return _retrieval_agent


def get_persona_agent() -> PersonaAgent:
    """Get or create the persona agent (lazy initialization)."""
    global _persona_agent
    if _persona_agent is None:
        _persona_agent = PersonaAgent()
    return _persona_agent


def get_persona_discovery() -> PersonaDiscoveryService:
    """Get or create the persona discovery service (lazy initialization)."""
    global _persona_discovery
    if _persona_discovery is None:
        _persona_discovery = PersonaDiscoveryService()
    return _persona_discovery


class ConnectionManager:
    def __init__(self) -> None:
        self.active: List[WebSocket] = []
        # Store active persona per connection
        self.active_personas: dict[WebSocket, str | None] = {}
        # Turn naturalness (Du/Sie, imperfection budget) per WebSocket connection
        self.turn_sessions: dict[WebSocket, TurnSessionState] = {}

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active.append(websocket)
        self.active_personas[websocket] = None

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active:
            self.active.remove(websocket)
        if websocket in self.active_personas:
            del self.active_personas[websocket]
        if websocket in self.turn_sessions:
            del self.turn_sessions[websocket]

    async def send_event(self, websocket: WebSocket, event) -> None:
        """Send an event to the WebSocket, handling connection state."""
        try:
            # Check if websocket is still in active connections
            if websocket not in self.active:
                return
            await websocket.send_text(event.model_dump_json())
        except Exception as e:
            import structlog
            logger = structlog.get_logger(__name__)
            logger.warning("ws.send_event.failed", error=str(e))
            # Remove from active connections if send fails
            if websocket in self.active:
                self.active.remove(websocket)
            raise


manager = ConnectionManager()


GUIDELINE_APPENDIX = """
Updated guidelines (2025-11-19):
- Answer succinctly in natural, conversational language.
- Avoid repeating phrases or including document/chunk IDs unless the user explicitly asks.
- Focus on the most relevant details; go deeper only when it materially helps the user.
- Skip confidence percentages unless the user specifically wants them.
""".strip()


def get_persona_prompt(persona_id: str) -> str | None:
    """Get system prompt for a persona, or generate a default one."""
    try:
        persona_uuid = UUID(persona_id)
    except ValueError:
        return None
    
    with get_session() as session:
        persona = session.get(Persona, persona_uuid)
        if not persona:
            return None
        
        # Try to get latest stored prompt (most recent by created_at)
        prompt = session.scalar(
            select(PersonaPrompt)
            .where(PersonaPrompt.persona_id == persona_uuid)
            .order_by(PersonaPrompt.created_at.desc())
            .limit(1)
        )
        
        if prompt:
            raw = getattr(prompt, "system_prompt", None) or getattr(prompt, "systemPrompt", None) or ""
            if (raw or "").strip():
                return f"{raw.strip()}\n\n{GUIDELINE_APPENDIX}"
        
        # Fallback: generate a basic prompt from persona data
        return f"""You are {persona.name}, representing the {persona.segment} perspective.

Your headline: {persona.headline}

Rules:
- Stay in persona and answer from this perspective.
- Challenge assumptions when appropriate.
- Answer succinctly in conversational language.
- Only reference supporting documents if the user explicitly asks.
- Skip confidence scores unless requested.

{GUIDELINE_APPENDIX}
"""


@router.websocket("/ws/chat/{conversation_id}")
async def chat_ws(websocket: WebSocket, conversation_id: str) -> None:
    """WebSocket endpoint for real-time chat with persona discovery."""
    import structlog
    logger = structlog.get_logger(__name__)

    if not await verify_websocket_token(websocket):
        return
    try:
        await manager.connect(websocket)
        logger.info("ws.connection.established", conversation_id=conversation_id)
        
        # Send initial connection confirmation immediately after accept
        await manager.send_event(websocket, ThinkingEvent(status="Connected"))
        
        # Use receive() instead of receive_text() to handle disconnections gracefully
        while True:
            try:
                message = await websocket.receive()
            except Exception as e:
                logger.warning("ws.receive.error", error=str(e))
                break
            
            # Handle disconnect messages (FastAPI sends this when client disconnects)
            if message.get("type") == "websocket.disconnect":
                logger.info("ws.disconnect.received", code=message.get("code"), reason=message.get("reason"))
                break
            
            # Handle close messages
            if "type" in message and message["type"] not in ("text", "bytes"):
                # This is a control message (ping/pong/disconnect), not a data message
                if message["type"] == "websocket.disconnect":
                    logger.info("ws.disconnect.received", code=message.get("code"), reason=message.get("reason"))
                    break
                # Ignore ping/pong and other control messages
                continue
            
            # Handle different message types
            if "text" in message:
                raw = message["text"]
            elif "bytes" in message:
                raw = message["bytes"].decode("utf-8")
            else:
                # Ignore other message types (ping/pong, etc.)
                logger.debug("ws.unknown_message_type", message_type=list(message.keys()))
                continue
            
            # Log raw message for debugging
            logger.info("ws.raw_message_received", raw=raw[:200] if len(raw) < 200 else raw[:200] + "...")
            
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError as e:
                logger.warning("ws.json_decode_error", error=str(e), raw=raw[:200])
                continue
            
            message_type = payload.get("type")
            logger.info("ws.message.received", type=message_type, has_persona_id=bool(payload.get("persona_id")), payload_keys=list(payload.keys()))
            
            # Handle persona_select FIRST, before message
            if message_type == "persona_select":
                persona_id = payload.get("persona_id")
                logger.info("ws.persona_select.received", persona_id=persona_id)
                if persona_id:
                    manager.active_personas[websocket] = persona_id
                    logger.info("ws.persona_select.stored", persona_id=persona_id, active_count=len(manager.active_personas))
                    # Get persona name for confirmation
                    try:
                        persona_uuid = UUID(persona_id)
                        with get_session() as session:
                            persona = session.get(Persona, persona_uuid)
                            persona_name = persona.name if persona else "Persona"
                    except (ValueError, Exception) as e:
                        logger.warning("ws.persona_select.fetch_failed", error=str(e))
                        persona_name = "Persona"
                    
                    await manager.send_event(
                        websocket,
                        ThinkingEvent(status=f"Ready to chat with {persona_name}. Ask your question!")
                    )
                continue
            
            if message_type == "message":
                user_id = (payload.get("user_id") or "").strip() or None
                active_persona_id = manager.active_personas.get(websocket)

                raw_history = payload.get("messages")
                if isinstance(raw_history, list) and len(raw_history) > 0:
                    msgs_for_spec: list[dict] = []
                    for m in raw_history:
                        if isinstance(m, dict) and m.get("role") in ("user", "assistant"):
                            msgs_for_spec.append(
                                {"role": m["role"], "content": m.get("content") or ""}
                            )
                    last_u, prev_u = extract_last_two_user_texts(msgs_for_spec)
                    query = (last_u or payload.get("content") or "").strip()
                else:
                    query = (payload.get("content") or "").strip()
                    last_u, prev_u = query, None
                
                logger.info("ws.message.processing", has_active_persona=bool(active_persona_id), persona_id=active_persona_id)
                
                if active_persona_id:
                    # User has selected a persona - generate chat response directly
                    await manager.send_event(websocket, ThinkingEvent(status="Retrieving relevant information…"))
                    # User has selected a persona - generate chat response
                    system_prompt = get_persona_prompt(active_persona_id)
                    if not system_prompt:
                        await manager.send_event(
                            websocket,
                            ThinkingEvent(status="Persona not found. Please select a persona first.")
                        )
                        continue
                    
                    # Get relevant sources for the query (run in executor to avoid blocking)
                    logger.info("ws.retrieval.starting", query=query[:100], persona_id=active_persona_id)
                    loop = asyncio.get_event_loop()
                    embedding, hits = await loop.run_in_executor(
                        None,
                        lambda: get_retrieval_agent().run(query=query, persona_segment=None)
                    )
                    logger.info("ws.retrieval.complete", hits_count=len(hits))
                    report_retrieval_query_usage(user_id, queries=1)

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
                    logger.info("ws.sources.prepared", sources_count=len(sources))
                    
                    # Stream response from persona
                    # Create a queue for events from the synchronous stream
                    event_queue: asyncio.Queue = asyncio.Queue()
                    
                    def send_event(event):
                        """Helper to queue events from synchronous stream."""
                        event_queue.put_nowait(event)
                    
                    if websocket not in manager.turn_sessions:
                        manager.turn_sessions[websocket] = TurnSessionState()
                    turn_session = manager.turn_sessions[websocket]
                    naturalness = build_turn_naturalness_spec(
                        last_user_text=last_u or query,
                        prev_user_text=prev_u,
                        session=turn_session,
                    )

                    # Run streaming in executor (it's synchronous)
                    async def stream_response():
                        loop = asyncio.get_event_loop()
                        await loop.run_in_executor(
                            None,
                            lambda: get_persona_agent().stream_response(
                                system_prompt=system_prompt,
                                question=query,
                                sources=sources,
                                persona_id=active_persona_id,
                                send_event=send_event,
                                usage_user_id=user_id,
                                reply_mode=naturalness.reply_mode,
                                turn_naturalness_addendum=naturalness.system_addendum_de,
                            )
                        )
                        # Signal completion
                        event_queue.put_nowait(None)
                    
                    # Start streaming
                    stream_task = asyncio.create_task(stream_response())
                    
                    # Process events as they come
                    while True:
                        event = await event_queue.get()
                        if event is None:
                            break
                        await manager.send_event(websocket, event)
                    
                    await stream_task
                    finalize_turn_session_after_assistant(manager.turn_sessions.get(websocket))
                else:
                    # No persona selected - discover personas
                    await manager.send_event(websocket, ThinkingEvent(status="Analyzing research…"))
                    try:
                        logger.info("ws.retrieval.starting", query=query[:100])
                        # Run retrieval in executor to avoid blocking
                        loop = asyncio.get_event_loop()
                        embedding, hits = await loop.run_in_executor(
                            None,
                            lambda: get_retrieval_agent().run(query=query, persona_segment=None)
                        )
                        logger.info("ws.retrieval.complete", hits_count=len(hits))
                        report_retrieval_query_usage(user_id, queries=1)

                        logger.info("ws.persona_discovery.starting")
                        emb_local = embedding

                        def _run_discover():
                            return get_persona_discovery().discover(query_embedding=emb_local)

                        candidates, usage_raw, llm_ok = await loop.run_in_executor(None, _run_discover)
                        if user_id and llm_ok:
                            if usage_raw:
                                report_usage(
                                    user_id=user_id,
                                    event_type="llm_request",
                                    raw_units=usage_raw,
                                )
                            else:
                                report_usage(
                                    user_id=user_id,
                                    event_type="persona_discover",
                                    raw_units={"runs": 1},
                                )
                        logger.info("ws.persona_discovery.complete", candidates_count=len(candidates))
                        
                        if candidates:
                            logger.info("ws.personas_discovered", count=len(candidates))
                            await manager.send_event(
                                websocket,
                                PersonasDiscoveredEvent(
                                    personas=[
                                        {
                                            "persona_id": candidate.chunk_ids[0] if candidate.chunk_ids else None,
                                            "name": candidate.name,
                                            "segment": candidate.segment,
                                            "confidence": candidate.confidence,
                                        }
                                        for candidate in candidates
                                    ]
                                ),
                            )
                        else:
                            logger.info("ws.no_personas_found")
                            await manager.send_event(
                                websocket,
                                ThinkingEvent(status="No personas found. Please try a different query or select an existing persona.")
                            )
                    except Exception as e:
                        logger.error("ws.persona_discovery.failed", error=str(e), exc_info=True)
                        await manager.send_event(
                            websocket,
                            ThinkingEvent(status=f"Error discovering personas: {str(e)}. Please try again or select an existing persona.")
                        )
            
            else:
                logger.warning("ws.unknown_message_type", type=message_type)
                await asyncio.sleep(0.05)
    except WebSocketDisconnect:
        logger.info("ws.connection.disconnected", conversation_id=conversation_id)
        manager.disconnect(websocket)
    except Exception as e:
        logger.error("ws.connection.error", error=str(e), conversation_id=conversation_id, exc_info=True)
        try:
            manager.disconnect(websocket)
        except Exception:
            logger.warning("ws.cleanup.disconnect_failed", error=str(e))

