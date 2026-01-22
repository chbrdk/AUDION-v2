"""UNION Client for AUDION"""
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
    
    async def log_event(
        self,
        event_type: str,
        payload: Dict[str, Any],
        channel: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Log a general event to UNION.
        
        Args:
            event_type: Type of event (e.g., "request", "error")
            payload: Event payload data
            channel: Optional Pub/Sub channel name
            metadata: Optional metadata
        """
        await self._send_event(
            service_name="audion",
            event_type=event_type,
            payload=payload,
            channel=channel or f"audion.{event_type}",
            metadata=metadata,
        )
    
    async def log_prompt(
        self,
        prompt_type: str,
        prompt: str,
        template_id: Optional[str] = None,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        context: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Log a prompt to UNION.
        
        Args:
            prompt_type: Type of prompt (e.g., "ai_assist", "chat")
            prompt: The rendered prompt text
            template_id: Optional template ID
            provider: Optional AI provider (e.g., "anthropic", "openai")
            model: Optional model name
            temperature: Optional temperature setting
            context: Optional prompt context
            metadata: Optional additional metadata
        """
        payload = {
            "prompt": prompt,
        }
        if template_id:
            payload["template_id"] = template_id
        if provider:
            payload["provider"] = provider
        if model:
            payload["model"] = model
        if temperature is not None:
            payload["temperature"] = temperature
        if context:
            payload["context"] = context
        
        await self._send_event(
            service_name="audion",
            event_type=f"prompt.{prompt_type}",
            payload=payload,
            channel=f"audion.prompts.{prompt_type}",
            metadata=metadata,
        )
    
    async def log_api_request(
        self,
        method: str,
        path: str,
        status_code: int,
        latency_ms: Optional[float] = None,
        request_body: Optional[Dict[str, Any]] = None,
        client_ip: Optional[str] = None,
        user_agent: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Log an API request to UNION.
        
        Args:
            method: HTTP method (GET, POST, etc.)
            path: Request path
            status_code: HTTP status code
            latency_ms: Optional request latency in milliseconds
            request_body: Optional request body
            client_ip: Optional client IP address
            user_agent: Optional user agent string
            metadata: Optional additional metadata
        """
        payload = {
            "method": method,
            "path": path,
            "status_code": status_code,
        }
        if latency_ms is not None:
            payload["latency_ms"] = latency_ms
        if request_body is not None:
            payload["request_body"] = request_body
        if client_ip:
            payload["client_ip"] = client_ip
        if user_agent:
            payload["user_agent"] = user_agent
        
        await self._send_event(
            service_name="audion",
            event_type="request",
            payload=payload,
            channel="audion.requests",
            metadata=metadata,
        )


# Global instance
union_client = UnionClient()

