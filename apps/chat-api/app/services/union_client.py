"""UNION Client for AUDION Chat API"""
from typing import Optional, Dict, Any
import httpx
import structlog
import asyncio

from ..core.config import get_settings

logger = structlog.get_logger(__name__)
settings = get_settings()


class UnionClient:
    """Client for UNION service to log events, prompts, and API requests."""
    
    def __init__(self, base_url: Optional[str] = None):
        # Default to UNION service URL (can be overridden via env)
        self.base_url = (base_url or getattr(settings, "union_base_url", "http://localhost:8000")).rstrip("/")
        self.timeout = 5.0  # 5 seconds timeout for logging requests
        self.retry_count = 2  # Retry failed requests up to 2 times
    
    async def _send_event(
        self,
        service_name: str,
        event_type: str,
        payload: Dict[str, Any],
        channel: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Send an event to UNION (fire-and-forget).
        
        This method does not block and will not raise exceptions.
        Errors are logged but do not affect the main request flow.
        """
        url = f"{self.base_url}/api/v1/events"
        
        event_data = {
            "service_name": service_name,
            "event_type": event_type,
            "payload": payload,
        }
        if channel:
            event_data["channel"] = channel
        if metadata:
            event_data["metadata"] = metadata
        
        # Fire and forget - run in background task
        async def _log():
            for attempt in range(self.retry_count + 1):
                try:
                    async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
                        response = await client.post(url, json=event_data)
                        response.raise_for_status()
                        logger.debug(
                            "union_client.event_logged",
                            service_name=service_name,
                            event_type=event_type,
                            status_code=response.status_code,
                        )
                        return
                except httpx.HTTPError as e:
                    if attempt < self.retry_count:
                        # Wait before retry (exponential backoff)
                        await asyncio.sleep(0.1 * (2 ** attempt))
                        continue
                    logger.warning(
                        "union_client.event_log_failed",
                        service_name=service_name,
                        event_type=event_type,
                        error=str(e),
                        url=url,
                    )
                except Exception as e:
                    logger.warning(
                        "union_client.event_log_error",
                        service_name=service_name,
                        event_type=event_type,
                        error=str(e),
                    )
                    return
        
        # Schedule background task (fire and forget)
        try:
            asyncio.create_task(_log())
        except Exception as e:
            logger.warning("union_client.failed_to_schedule_log", error=str(e))
    
    async def log_prompt(
        self,
        prompt_type: str,
        messages: list,
        system_prompt: Optional[str] = None,
        persona_id: Optional[str] = None,
        model: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Log a chat prompt to UNION.
        
        Args:
            prompt_type: Type of prompt (e.g., "chat")
            messages: List of chat messages
            system_prompt: Optional system prompt
            persona_id: Optional persona ID
            model: Optional model name
            metadata: Optional additional metadata
        """
        payload = {
            "messages": messages,
        }
        if system_prompt:
            payload["system_prompt"] = system_prompt
        if persona_id:
            payload["persona_id"] = persona_id
        if model:
            payload["model"] = model
        
        await self._send_event(
            service_name="audion",
            event_type=f"prompt.{prompt_type}",
            payload=payload,
            channel=f"audion.prompts.{prompt_type}",
            metadata=metadata,
        )


# Global instance
union_client = UnionClient()

