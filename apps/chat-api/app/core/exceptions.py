from __future__ import annotations

from fastapi import HTTPException, status


class PersonaNotFoundError(HTTPException):
    def __init__(self, persona_id: str) -> None:
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Persona {persona_id} not found"
        )


class ConversationNotFoundError(HTTPException):
    def __init__(self, conversation_id: str) -> None:
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation {conversation_id} not found"
        )


class DocumentNotReadyError(HTTPException):
    def __init__(self, document_id: str) -> None:
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Document {document_id} is not ready for chat. Processing may still be in progress."
        )

