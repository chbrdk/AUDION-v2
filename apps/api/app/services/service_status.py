from __future__ import annotations

import asyncio
from typing import List

import httpx
import structlog
from neo4j import GraphDatabase
from qdrant_client import QdrantClient
from redis import Redis
from sqlalchemy import text

from ..core.config import get_settings
from ..db import engine
from ..schemas import ServiceStatus, ServiceStatusResponse

logger = structlog.get_logger(__name__)
settings = get_settings()


class ServiceStatusService:
    """Service to check the health status of all system services."""

    async def check_postgres(self) -> ServiceStatus:
        """Check PostgreSQL database connection."""
        try:
            # Run in thread pool since SQLAlchemy is synchronous
            loop = asyncio.get_event_loop()
            def check():
                with engine.connect() as conn:
                    conn.execute(text("SELECT 1"))
            
            await loop.run_in_executor(None, check)
            return ServiceStatus(name="PostgreSQL", status="up", message=None)
        except Exception as e:
            logger.warning("PostgreSQL check failed", error=str(e))
            return ServiceStatus(name="PostgreSQL", status="down", message=str(e))

    async def check_redis(self) -> ServiceStatus:
        """Check Redis connection."""
        try:
            # Parse Redis URL
            redis_url = settings.redis_url.replace("redis://", "")
            if "/" in redis_url:
                host_port, db = redis_url.split("/")
            else:
                host_port, db = redis_url, "0"
            
            if ":" in host_port:
                host, port = host_port.split(":")
            else:
                host, port = host_port, "6379"
            
            # Run in thread pool since Redis client is synchronous
            loop = asyncio.get_event_loop()
            def check():
                redis_client = Redis(host=host, port=int(port), db=int(db), socket_connect_timeout=2)
                try:
                    redis_client.ping()
                finally:
                    redis_client.close()
            
            await loop.run_in_executor(None, check)
            return ServiceStatus(name="Redis", status="up", message=None)
        except Exception as e:
            logger.warning("Redis check failed", error=str(e))
            return ServiceStatus(name="Redis", status="down", message=str(e))

    async def check_qdrant(self) -> ServiceStatus:
        """Check Qdrant vector database."""
        try:
            # Run in thread pool since Qdrant client is synchronous
            loop = asyncio.get_event_loop()
            def check():
                client = QdrantClient(url=settings.qdrant_url, timeout=2)
                client.get_collections()
            
            await loop.run_in_executor(None, check)
            return ServiceStatus(name="Qdrant", status="up", message=None)
        except Exception as e:
            logger.warning("Qdrant check failed", error=str(e))
            return ServiceStatus(name="Qdrant", status="down", message=str(e))

    async def check_neo4j(self) -> ServiceStatus:
        """Check Neo4j graph database."""
        try:
            # Run in thread pool since Neo4j driver is synchronous
            loop = asyncio.get_event_loop()
            def check():
                driver = GraphDatabase.driver(
                    settings.neo4j_uri,
                    auth=(settings.neo4j_user, settings.neo4j_password),
                    connection_timeout=2,
                )
                try:
                    with driver.session() as session:
                        session.run("RETURN 1")
                finally:
                    driver.close()
            
            await loop.run_in_executor(None, check)
            return ServiceStatus(name="Neo4j", status="up", message=None)
        except Exception as e:
            logger.warning("Neo4j check failed", error=str(e))
            return ServiceStatus(name="Neo4j", status="down", message=str(e))

    async def check_tempo(self) -> ServiceStatus:
        """Check Tempo observability service."""
        try:
            tempo_url = settings.otel_exporter_otlp_endpoint
            if not tempo_url:
                return ServiceStatus(name="Tempo", status="unknown", message="Not configured")
            
            # Extract base URL (remove /v1/traces if present)
            base_url = tempo_url.replace("/v1/traces", "").replace("/v1/trace", "")
            
            async with httpx.AsyncClient(timeout=2.0) as client:
                # Try to reach the endpoint
                response = await client.get(f"{base_url}/ready", follow_redirects=True)
                if response.status_code < 500:
                    return ServiceStatus(name="Tempo", status="up", message=None)
                else:
                    return ServiceStatus(name="Tempo", status="down", message=f"HTTP {response.status_code}")
        except Exception as e:
            logger.warning("Tempo check failed", error=str(e))
            return ServiceStatus(name="Tempo", status="down", message=str(e))

    async def check_indexing_api(self) -> ServiceStatus:
        """Check Indexing API service."""
        try:
            # Try to infer the indexing API URL from environment or use default
            # In Docker compose, it's http://indexing-api:8000
            # For external checks, we might need a config value
            indexing_url = "http://indexing-api:8000"
            
            async with httpx.AsyncClient(timeout=2.0) as client:
                response = await client.get(f"{indexing_url}/health", follow_redirects=True)
                if response.status_code < 500:
                    return ServiceStatus(name="Indexing API", status="up", message=None)
                else:
                    return ServiceStatus(name="Indexing API", status="down", message=f"HTTP {response.status_code}")
        except Exception as e:
            logger.warning("Indexing API check failed", error=str(e))
            return ServiceStatus(name="Indexing API", status="down", message=str(e))

    async def check_chat_api(self) -> ServiceStatus:
        """Check Chat API service."""
        try:
            # Try to infer the chat API URL
            chat_url = "http://chat-api:8001"
            
            async with httpx.AsyncClient(timeout=2.0) as client:
                response = await client.get(f"{chat_url}/health", follow_redirects=True)
                if response.status_code < 500:
                    return ServiceStatus(name="Chat API", status="up", message=None)
                else:
                    return ServiceStatus(name="Chat API", status="down", message=f"HTTP {response.status_code}")
        except Exception as e:
            logger.warning("Chat API check failed", error=str(e))
            return ServiceStatus(name="Chat API", status="down", message=str(e))

    async def check_persona_api(self) -> ServiceStatus:
        """Check Persona API service (this service)."""
        try:
            # This is the current service, so we can just return up
            return ServiceStatus(name="Persona API", status="up", message=None)
        except Exception as e:
            logger.warning("Persona API check failed", error=str(e))
            return ServiceStatus(name="Persona API", status="down", message=str(e))

    async def check_web(self) -> ServiceStatus:
        """Check Web frontend service."""
        try:
            web_url = settings.persona_console_base_url
            
            async with httpx.AsyncClient(timeout=2.0) as client:
                response = await client.get(f"{web_url}/", follow_redirects=True)
                if response.status_code < 500:
                    return ServiceStatus(name="Web", status="up", message=None)
                else:
                    return ServiceStatus(name="Web", status="down", message=f"HTTP {response.status_code}")
        except Exception as e:
            logger.warning("Web check failed", error=str(e))
            return ServiceStatus(name="Web", status="down", message=str(e))

    async def check_nginx(self) -> ServiceStatus:
        """Check Nginx reverse proxy."""
        try:
            # Try to check nginx through the public URL
            # This is a best-effort check
            nginx_url = settings.persona_backend_public_url.replace("/api/persona-backend", "")
            
            async with httpx.AsyncClient(timeout=2.0) as client:
                response = await client.get(f"{nginx_url}/", follow_redirects=True)
                if response.status_code < 500:
                    return ServiceStatus(name="Nginx", status="up", message=None)
                else:
                    return ServiceStatus(name="Nginx", status="down", message=f"HTTP {response.status_code}")
        except Exception as e:
            logger.warning("Nginx check failed", error=str(e))
            return ServiceStatus(name="Nginx", status="down", message=str(e))

    async def get_service_status(self) -> ServiceStatusResponse:
        """Get status of all services."""
        # Run all checks in parallel
        results = await asyncio.gather(
            self.check_postgres(),
            self.check_redis(),
            self.check_qdrant(),
            self.check_neo4j(),
            self.check_tempo(),
            self.check_indexing_api(),
            self.check_chat_api(),
            self.check_persona_api(),
            self.check_web(),
            self.check_nginx(),
            return_exceptions=True,
        )
        
        # Convert exceptions to error statuses
        services: List[ServiceStatus] = []
        for result in results:
            if isinstance(result, Exception):
                services.append(ServiceStatus(name="Unknown", status="down", message=str(result)))
            else:
                services.append(result)
        
        # Critical services that must be up
        critical_services = ["PostgreSQL", "Redis", "Qdrant", "Neo4j"]
        all_critical_up = all(
            any(s.name == name and s.status == "up" for s in services)
            for name in critical_services
        )
        
        return ServiceStatusResponse(
            services=services,
            all_services_up=all_critical_up,
        )

