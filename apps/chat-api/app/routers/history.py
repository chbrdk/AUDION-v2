from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from ..db import get_session
from ..deps import verify_request_token
from ..models import ChatConversation, ChatConversationMessage, Persona

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/chat/history", tags=["chat-history"])


class ConversationUpsertBody(BaseModel):
    conversation_id: str = Field(..., min_length=1, max_length=128)
    persona_id: str = Field(..., min_length=1)
    persona_name: str | None = None
    title: str | None = None
    metadata: dict[str, Any] | None = None


class AppendMessageBody(BaseModel):
    role: str = Field(..., min_length=1, max_length=32)
    content: str = Field(..., min_length=1)
    extra: dict[str, Any] | None = None
    # Optional: allow upsert of conversation if it doesn't exist yet
    persona_id: str | None = None
    persona_name: str | None = None
    title: str | None = None


@router.post("/conversations/upsert")
def upsert_conversation(body: ConversationUpsertBody, _: None = Depends(verify_request_token)) -> dict[str, Any]:
    try:
        persona_uuid = UUID(body.persona_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid persona_id") from None

    with get_session() as session:
        persona = session.get(Persona, persona_uuid)
        if not persona:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Persona not found")

        convo = session.get(ChatConversation, body.conversation_id)
        if convo is None:
            convo = ChatConversation(
                id=body.conversation_id,
                persona_id=persona_uuid,
                persona_name=(body.persona_name or getattr(persona, "name", "") or "").strip(),
                title=(body.title or "New Conversation").strip(),
                metadata=body.metadata,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            session.add(convo)
        else:
            convo.persona_id = persona_uuid
            if body.persona_name is not None:
                convo.persona_name = body.persona_name
            if body.title is not None:
                convo.title = body.title
            if body.metadata is not None:
                convo.metadata = body.metadata
            convo.updated_at = datetime.utcnow()

        session.commit()

    return {"success": True}


@router.post("/conversations/{conversation_id}/messages")
def append_message(
    conversation_id: str,
    body: AppendMessageBody,
    _: None = Depends(verify_request_token),
) -> dict[str, Any]:
    if not conversation_id or len(conversation_id) > 128:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid conversation_id")

    with get_session() as session:
        convo = session.get(ChatConversation, conversation_id)
        if convo is None:
            # Upsert-on-append: require persona_id to create.
            if not body.persona_id:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Conversation missing; persona_id required to create")
            try:
                persona_uuid = UUID(body.persona_id)
            except ValueError:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid persona_id") from None

            persona = session.get(Persona, persona_uuid)
            if not persona:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Persona not found")

            convo = ChatConversation(
                id=conversation_id,
                persona_id=persona_uuid,
                persona_name=(body.persona_name or getattr(persona, "name", "") or "").strip(),
                title=(body.title or "New Conversation").strip(),
                metadata=None,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            session.add(convo)
            session.flush()

        msg = ChatConversationMessage(
            conversation_id=conversation_id,
            role=body.role.strip(),
            content=body.content,
            extra=body.extra,
            created_at=datetime.utcnow(),
        )
        session.add(msg)
        convo.updated_at = datetime.utcnow()
        session.commit()

        logger.info("chat.history.message.appended", conversation_id=conversation_id, role=body.role)

    return {"success": True}

