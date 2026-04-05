from __future__ import annotations

import asyncio
import json
from typing import List

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from msqdx_glass_proto import PersonasDiscoveredEvent, ThinkingEvent

from ..agents.persona import PersonaAgent
from ..agents.retrieval import RetrievalAgent
from ..services.persona_discovery import PersonaDiscoveryService
from ..services.usage_report import report_retrieval_query_usage, report_usage

router = APIRouter()
retrieval_agent = RetrievalAgent()
persona_agent = PersonaAgent()
persona_discovery = PersonaDiscoveryService()


class ConnectionManager:
    def __init__(self) -> None:
        self.active: List[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active:
            self.active.remove(websocket)

    async def send_event(self, websocket: WebSocket, event) -> None:
        await websocket.send_text(event.model_dump_json())


manager = ConnectionManager()


@router.websocket("/ws/chat/{conversation_id}")
async def chat_ws(websocket: WebSocket, conversation_id: str) -> None:
    await manager.connect(websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            payload = json.loads(raw)
            if payload.get("type") == "message":
                query = payload["content"]
                user_id = (payload.get("user_id") or "").strip() or None
                await manager.send_event(websocket, ThinkingEvent(status="Analyzing research…"))
                embedding, hits = retrieval_agent.run(query=query, persona_segment=None)
                if user_id:
                    report_retrieval_query_usage(user_id, queries=1)
                candidates, usage_raw, llm_ok = persona_discovery.discover(query_embedding=embedding)
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
                await asyncio.sleep(0.05)
    except WebSocketDisconnect:
        manager.disconnect(websocket)

