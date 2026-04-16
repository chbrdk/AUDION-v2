"""Merge chat attachment metadata (temporary document IDs) into model-facing user text."""

from __future__ import annotations

from typing import List, Optional


def merge_user_message_content_with_documents(
    content: str,
    document_ids: Optional[List[str]],
) -> str:
    """
    Prepend extracted DOCX text for each valid document_id, then the user's visible message.
    Used only for the LLM request; retrieval / turn-naturalness should use raw ``content``.
    """
    if not document_ids:
        return content or ""

    from ..routers.documents import get_document_payload

    blocks: list[str] = []
    for did in document_ids:
        if not (did and str(did).strip()):
            continue
        payload = get_document_payload(str(did).strip())
        if not payload:
            continue
        fn = str(payload.get("filename") or "document").strip() or "document"
        body = str(payload.get("text") or "").strip()
        if not body:
            continue
        blocks.append(f"### Attached document: {fn}\n\n{body}")
    if not blocks:
        return content or ""
    prefix = "\n\n---\n\n".join(blocks) + "\n\n---\n\n"
    rest = (content or "").strip()
    return prefix + rest if rest else prefix.rstrip()
