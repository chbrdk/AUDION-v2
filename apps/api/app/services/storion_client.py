"""STORION Client for AUDION"""
from typing import Optional, Dict, Any, List
import httpx
import structlog

from ..core.config import get_settings

logger = structlog.get_logger(__name__)
settings = get_settings()


class StorionClient:
    """Client for STORION service."""
    
    def __init__(self, base_url: Optional[str] = None):
        # Default to STORION service URL (can be overridden via env)
        self.base_url = base_url or getattr(settings, "storion_base_url", "http://storion:8003")
        self.timeout = 30.0  # 30 seconds timeout for file uploads
        self.search_timeout = 60.0  # Longer timeout for search operations
    
    async def upload_file(
        self,
        file_content: bytes,
        filename: str,
        service: str,
        entity_type: str,
        entity_id: str,
        uploaded_by: Optional[str] = None,
    ) -> dict:
        """Upload file to STORION."""
        url = f"{self.base_url}/api/v1/files/upload"
        
        params = {
            "service": service,
            "entity_type": entity_type,
            "entity_id": entity_id,
        }
        if uploaded_by:
            params["uploaded_by"] = uploaded_by
        
        files = {"file": (filename, file_content)}
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
                response = await client.post(
                    url,
                    files=files,
                    params=params,
                )
                response.raise_for_status()
                return response.json()
        except httpx.HTTPError as e:
            logger.error("storion_client.upload_failed", error=str(e), url=url)
            raise
    
    async def get_file(self, file_id: str) -> dict:
        """Get file metadata from STORION."""
        url = f"{self.base_url}/api/v1/files/{file_id}"
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url)
                response.raise_for_status()
                return response.json()
        except httpx.HTTPError as e:
            logger.error("storion_client.get_file_failed", error=str(e), file_id=file_id)
            raise
    
    async def list_files(
        self,
        service: Optional[str] = None,
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list:
        """List files from STORION."""
        url = f"{self.base_url}/api/v1/files"
        
        params = {
            "limit": limit,
            "offset": offset,
        }
        if service:
            params["service"] = service
        if entity_type:
            params["entity_type"] = entity_type
        if entity_id:
            params["entity_id"] = entity_id
        if status:
            params["status"] = status
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                return response.json()
        except httpx.HTTPError as e:
            logger.error("storion_client.list_files_failed", error=str(e), params=params)
            raise
    
    async def get_job_status(self, job_id: str) -> dict:
        """Get processing job status from STORION."""
        url = f"{self.base_url}/api/v1/jobs/{job_id}/status"
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url)
                response.raise_for_status()
                return response.json()
        except httpx.HTTPError as e:
            logger.error("storion_client.get_job_status_failed", error=str(e), job_id=job_id)
            raise
    
    async def search_vectors(
        self,
        query: str,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 100,
        collection: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Search vectors in STORION using text query.
        
        Args:
            query: Text query to search for
            filters: Optional filters (e.g., {"target_group_ids": ["uuid"]})
            limit: Maximum number of results
            collection: Optional collection name (uses global collection if not specified)
        
        Returns:
            Dict with "chunks" list and "total" count
        """
        url = f"{self.base_url}/api/v1/search"
        
        payload = {
            "query": query,
            "limit": limit,
        }
        if filters:
            payload["filters"] = filters
        if collection:
            payload["collection"] = collection
        
        try:
            async with httpx.AsyncClient(timeout=self.search_timeout) as client:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                return response.json()
        except httpx.HTTPError as e:
            logger.error(
                "storion_client.search_vectors_failed",
                error=str(e),
                query=query[:50] if query else None,
                filters=filters,
            )
            raise
    
    async def get_chunks_by_entity(
        self,
        entity_type: str,
        entity_id: str,
        service: str = "audion",
        limit: int = 1000,
    ) -> List[Dict[str, Any]]:
        """Get chunks for a specific entity from STORION.
        
        Uses vector search with a broad query and entity filter to retrieve all chunks
        associated with the entity.
        
        Args:
            entity_type: Entity type (e.g., "target_group", "persona")
            entity_id: Entity UUID string
            service: Service name (default: "audion")
            limit: Maximum number of chunks to retrieve
        
        Returns:
            List of chunk dictionaries with content, metadata, and embeddings
        """
        # Build filter based on entity type
        filters: Dict[str, Any] = {
            "service": service,
            "entity_type": entity_type,
        }
        
        # Add entity-specific filter
        if entity_type == "target_group":
            filters["target_group_ids"] = [entity_id]
        elif entity_type == "persona":
            filters["persona_ids"] = [entity_id]
        elif entity_type == "wave":
            filters["wave_ids"] = [entity_id]
        elif entity_type == "journey":
            filters["journey_ids"] = [entity_id]
        else:
            filters["entity_id"] = entity_id
        
        # Use a broad query to get all chunks (we filter by entity)
        # Empty or very general query should return all chunks matching the filter
        try:
            result = await self.search_vectors(
                query="*",  # Broad query to match all chunks
                filters=filters,
                limit=limit,
            )
            chunks = result.get("chunks", [])
            logger.info(
                "storion_client.chunks_retrieved",
                entity_type=entity_type,
                entity_id=entity_id,
                chunks_count=len(chunks),
            )
            return chunks
        except Exception as e:
            logger.error(
                "storion_client.get_chunks_by_entity_failed",
                error=str(e),
                entity_type=entity_type,
                entity_id=entity_id,
            )
            raise
    
    async def get_file_chunks(
        self,
        file_id: str,
        limit: int = 1000,
    ) -> List[Dict[str, Any]]:
        """Get chunks for a specific file from STORION.
        
        Args:
            file_id: STORION file UUID string
            limit: Maximum number of chunks to retrieve
        
        Returns:
            List of chunk dictionaries with content, metadata, and embeddings
        """
        filters: Dict[str, Any] = {
            "file_id": file_id,
        }
        
        try:
            result = await self.search_vectors(
                query="*",  # Broad query to match all chunks for this file
                filters=filters,
                limit=limit,
            )
            chunks = result.get("chunks", [])
            logger.info(
                "storion_client.file_chunks_retrieved",
                file_id=file_id,
                chunks_count=len(chunks),
            )
            return chunks
        except Exception as e:
            logger.error(
                "storion_client.get_file_chunks_failed",
                error=str(e),
                file_id=file_id,
            )
            raise


# Global instance
storion_client = StorionClient()













