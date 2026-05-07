"""
In-process registry for human-in-the-loop tool-call confirmations.

When `chat_action_tools_require_confirmation` is enabled, an action tool (e.g.
`inspect_website`) emits a `ToolProposedEvent` to the SSE stream and BLOCKS the
worker thread on a `threading.Event`. The frontend shows a confirm UI; on user
click it POSTs to `/chat/tool-call/decision/{call_id}`, which calls
`record_decision(...)` here and signals the waiting thread.

Why threading (not asyncio):
The persona agent runs the OpenAI tool-call loop in a worker thread (see
`PersonaAgent._stream_response_with_tools`). The decision endpoint runs in the
asyncio FastAPI event loop. Cross-boundary signalling needs an OS-level
primitive — a `threading.Event` works for both.

Why in-process (not Redis):
Single-replica deployment today. If we ever scale chat-api horizontally, swap
the registry for a Redis pub/sub variant — the function signatures here are
deliberately small to make that swap easy.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from typing import Dict, Literal, Optional

import structlog

logger = structlog.get_logger(__name__)

Decision = Literal["approve", "deny"]


@dataclass
class _PendingDecision:
    event: threading.Event = field(default_factory=threading.Event)
    decision: Optional[Decision] = None
    reason: Optional[str] = None  # Free-form note from the user when denying.


_pending: Dict[str, _PendingDecision] = {}
_lock = threading.Lock()


def register(call_id: str) -> _PendingDecision:
    """Reserve a slot for a call_id. The waiter then calls `wait_for_decision`."""
    with _lock:
        if call_id in _pending:
            # Defensive: caller bug. We overwrite to avoid an old entry blocking forever.
            logger.warning("tool_decisions.register.replacing_existing", call_id=call_id)
        slot = _PendingDecision()
        _pending[call_id] = slot
    return slot


def wait_for_decision(
    call_id: str,
    *,
    timeout_seconds: float,
) -> tuple[Decision, Optional[str]]:
    """
    Block (in the calling thread) until a decision is recorded or the timeout
    fires. Always cleans up the registry slot before returning.

    Returns ("deny", reason) if the timeout fires before a decision arrives.
    """
    with _lock:
        slot = _pending.get(call_id)
    if slot is None:
        # Either register() was never called or another thread already cleaned up.
        # We auto-deny so callers fail closed instead of hanging forever.
        logger.warning("tool_decisions.wait.missing_slot", call_id=call_id)
        return "deny", "internal: no pending decision slot"

    fired = slot.event.wait(timeout=timeout_seconds)
    with _lock:
        _pending.pop(call_id, None)

    if not fired:
        return "deny", "User did not respond within the confirmation window."
    return (slot.decision or "deny"), slot.reason


def record_decision(
    call_id: str,
    decision: Decision,
    *,
    reason: Optional[str] = None,
) -> bool:
    """
    Mark a pending decision and wake the waiting worker. Returns True if the
    call_id was indeed waiting, False otherwise (e.g. timed out, already decided,
    or the chat request died).
    """
    with _lock:
        slot = _pending.get(call_id)
        if slot is None:
            return False
        if slot.event.is_set():
            return False  # Already decided; idempotent NOOP.
        slot.decision = decision
        slot.reason = reason
        slot.event.set()
        return True


def cancel_pending(call_id: str) -> None:
    """Drop a slot without signalling — useful when the originating chat
    request was aborted before the user replied."""
    with _lock:
        _pending.pop(call_id, None)
