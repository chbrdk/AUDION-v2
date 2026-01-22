"""UNION Settings Client for AUDION"""
from typing import Optional, Dict, Any
import httpx
import structlog
import os
import redis
from functools import lru_cache

from ..core.config import get_settings

logger = structlog.get_logger(__name__)
settings = get_settings()


class UnionSettingsClient:
    """Client for UNION Settings API to retrieve API keys."""
    
    def __init__(self, base_url: Optional[str] = None, cache_ttl: int = 900):
        """
        Initialize UNION Settings Client.
        
        Args:
            base_url: UNION API base URL (defaults to UNION_BASE_URL from settings or env var)
            cache_ttl: Cache TTL in seconds (default: 900 = 15 minutes)
        """
        # Check environment variable first, then settings, then default
        import os
        env_union_url = os.getenv("UNION_BASE_URL")
        if base_url:
            self.base_url = base_url.rstrip("/")
        elif env_union_url:
            self.base_url = env_union_url.rstrip("/")
        else:
            self.base_url = (getattr(settings, "union_base_url", None) or "http://localhost:8000").rstrip("/")
        self.timeout = 5.0  # 5 seconds timeout
        self.retry_count = 2  # Retry failed requests up to 2 times
        self.cache_ttl = cache_ttl
        
        # Initialize Redis cache if available
        self._redis_client = None
        try:
            redis_url = getattr(settings, "redis_url", None) or os.getenv("REDIS_URL", "redis://localhost:6379/0")
            self._redis_client = redis.from_url(redis_url, decode_responses=True)
            # Test connection
            self._redis_client.ping()
            logger.info("union_settings_client.redis_connected")
        except Exception as e:
            logger.warning("union_settings_client.redis_unavailable", error=str(e))
            self._redis_client = None
    
    def _get_cache_key(self, service_name: str, key_name: Optional[str] = None) -> str:
        """Generate cache key."""
        if key_name:
            return f"union:settings:{service_name}:{key_name}"
        return f"union:settings:{service_name}:all"
    
    def _get_from_cache(self, cache_key: str) -> Optional[Any]:
        """Get value from Redis cache."""
        if not self._redis_client:
            return None
        
        try:
            import json
            cached = self._redis_client.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception as e:
            logger.warning("union_settings_client.cache_get_failed", key=cache_key, error=str(e))
        
        return None
    
    def _set_cache(self, cache_key: str, value: Any) -> None:
        """Set value in Redis cache."""
        if not self._redis_client:
            return
        
        try:
            import json
            self._redis_client.setex(
                cache_key,
                self.cache_ttl,
                json.dumps(value)
            )
        except Exception as e:
            logger.warning("union_settings_client.cache_set_failed", key=cache_key, error=str(e))
    
    async def _fetch_from_union(self, endpoint: str) -> Optional[Dict[str, Any]]:
        """Fetch data from UNION API with retry logic."""
        url = f"{self.base_url}/api/v1/admin{endpoint}"
        
        for attempt in range(self.retry_count + 1):
            try:
                async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
                    response = await client.get(url)
                    response.raise_for_status()
                    return response.json()
            except httpx.HTTPError as e:
                if attempt < self.retry_count:
                    # Exponential backoff
                    import asyncio
                    await asyncio.sleep(0.1 * (2 ** attempt))
                    continue
                logger.warning(
                    "union_settings_client.fetch_failed",
                    url=url,
                    error=str(e),
                    attempt=attempt + 1,
                )
                return None
            except Exception as e:
                logger.warning(
                    "union_settings_client.fetch_error",
                    url=url,
                    error=str(e),
                )
                return None
        
        return None
    
    async def get_api_key(self, key_name: str, service_name: str = "audion") -> Optional[str]:
        """
        Get a single API key value from UNION.
        
        Args:
            key_name: Name of the key (e.g., "openai_api_key")
            service_name: Service name (default: "audion")
        
        Returns:
            Decrypted API key value or None if not found
        """
        # Check cache first
        cache_key = self._get_cache_key(service_name, key_name)
        cached = self._get_from_cache(cache_key)
        if cached is not None:
            return cached
        
        # Fetch all settings for the service (more efficient than individual calls)
        all_settings = await self.get_api_keys(service_name)
        if all_settings and key_name in all_settings:
            value = all_settings[key_name]
            # Cache individual key
            self._set_cache(cache_key, value)
            return value
        
        return None
    
    async def get_api_keys(self, service_name: str = "audion") -> Dict[str, str]:
        """
        Get all API keys for a service from UNION.
        
        Args:
            service_name: Service name (default: "audion")
        
        Returns:
            Dictionary of key_name -> key_value
        """
        # Check cache first
        cache_key = self._get_cache_key(service_name)
        cached = self._get_from_cache(cache_key)
        if cached is not None:
            return cached
        
        # Fetch from UNION
        endpoint = f"/settings/keys-all?service_name={service_name}"
        response = await self._fetch_from_union(endpoint)
        
        if response and "settings" in response:
            settings_dict = response["settings"]
            # Cache the result
            self._set_cache(cache_key, settings_dict)
            logger.info(
                "union_settings_client.keys_loaded",
                service_name=service_name,
                count=len(settings_dict),
            )
            return settings_dict
        
        # Return empty dict if fetch failed
        logger.warning(
            "union_settings_client.keys_load_failed",
            service_name=service_name,
        )
        return {}


# Global instance
union_settings_client = UnionSettingsClient()
