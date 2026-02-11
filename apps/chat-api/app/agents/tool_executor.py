"""
Tool Execution Handler for Knowledge Tools.

Executes Anthropic tool calls and returns results in the expected format.
"""

from __future__ import annotations

from typing import Dict, Any
from uuid import UUID

import structlog

from sqlalchemy import select

from ..agents.retrieval import RetrievalAgent
from ..core.config import get_settings
from ..db import get_session
from ..models import DocumentChunk

logger = structlog.get_logger(__name__)
settings = get_settings()


class ToolExecutor:
    """Executes tool calls for Knowledge Base access."""
    
    def __init__(self):
        self.retrieval_agent = RetrievalAgent()
    
    async def execute_tool(
        self,
        tool_name: str,
        arguments: Dict[str, Any],
        persona_segment: str | None = None
    ) -> Dict[str, Any]:
        """
        Execute a tool call and return results.
        
        Args:
            tool_name: Name of the tool to execute
            arguments: Tool arguments as a dictionary
            persona_segment: Optional persona segment for filtering
            
        Returns:
            Dictionary with tool execution results
        """
        logger.info("tool_executor.execute", tool_name=tool_name, arguments_keys=list(arguments.keys()))
        
        if tool_name == "search_knowledge":
            return await self._search_knowledge(arguments, persona_segment)
        elif tool_name == "get_target_group_knowledge":
            return await self._get_target_group_knowledge(arguments)
        elif tool_name == "get_document_content":
            return await self._get_document_content(arguments)
        else:
            logger.warning("tool_executor.unknown_tool", tool_name=tool_name)
            return {
                "error": f"Unknown tool: {tool_name}",
                "results": []
            }
    
    async def _search_knowledge(
        self,
        arguments: Dict[str, Any],
        persona_segment: str | None = None
    ) -> Dict[str, Any]:
        """Execute search_knowledge tool."""
        query = arguments.get("query", "")
        limit = min(arguments.get("limit", 5), 20)
        segment = arguments.get("persona_segment") or persona_segment
        
        if not query:
            return {
                "error": "Query is required",
                "results": [],
                "count": 0
            }
        
        try:
            # Use RetrievalAgent to search Qdrant
            _, hits = self.retrieval_agent.run(query=query, persona_segment=segment)
            
            results = []
            for hit in hits[:limit]:
                if not hit.payload:
                    continue
                
                # Extract score from hit (handle different Qdrant response formats)
                score = 0.0
                if hasattr(hit, "score"):
                    score = float(hit.score)
                elif isinstance(hit, dict) and "score" in hit:
                    score = float(hit["score"])
                
                results.append({
                    "chunk_id": str(hit.payload.get("chunk_id", "")),
                    "document_id": str(hit.payload.get("document_id", "")),
                    "content": hit.payload.get("content", "")[:500],  # Limit content length
                    "score": score,
                })
            
            logger.info(
                "tool_executor.search_knowledge.complete",
                query=query[:100],
                results_count=len(results)
            )
            
            return {
                "results": results,
                "count": len(results)
            }
        except Exception as exc:
            logger.error("tool_executor.search_knowledge.failed", error=str(exc), exc_info=True)
            return {
                "error": f"Search failed: {str(exc)}",
                "results": [],
                "count": 0
            }
    
    async def _get_target_group_knowledge(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Execute get_target_group_knowledge tool."""
        target_group_id = arguments.get("target_group_id", "")
        limit = min(arguments.get("limit", 10), 50)
        
        if not target_group_id:
            return {
                "error": "target_group_id is required",
                "results": [],
                "count": 0
            }
        
        try:
            # Validate UUID format
            UUID(target_group_id)
        except ValueError:
            return {
                "error": "Invalid target_group_id format (must be UUID)",
                "results": [],
                "count": 0
            }
        
        # For now, use a semantic search approach since KnowledgeExplorerService
        # requires models from api app that may not be available here
        # TODO: Consider making an API call to api app or sharing the service
        
        # Try to search with target_group_id filter via Qdrant
        try:
            
            # Search for chunks with target_group_id in payload
            # This is a simplified approach - ideally we'd use KnowledgeExplorerService
            query = "target group knowledge"
            _, hits = self.retrieval_agent.run(query=query, persona_segment=None)
            
            # Filter by target_group_id if available in payload
            filtered_results = []
            for hit in hits:
                if not hit.payload:
                    continue
                if str(hit.payload.get("target_group_id", "")) == target_group_id:
                    score = 0.0
                    if hasattr(hit, "score"):
                        score = float(hit.score)
                    elif isinstance(hit, dict) and "score" in hit:
                        score = float(hit["score"])
                    
                    filtered_results.append({
                        "chunk_id": str(hit.payload.get("chunk_id", "")),
                        "document_id": str(hit.payload.get("document_id", "")),
                        "content": hit.payload.get("content", "")[:500],
                        "score": score,
                    })
                    
                    if len(filtered_results) >= limit:
                        break
            
            logger.info(
                "tool_executor.get_target_group_knowledge.complete",
                target_group_id=target_group_id,
                results_count=len(filtered_results)
            )
            
            return {
                "results": filtered_results,
                "count": len(filtered_results)
            }
        except Exception as exc:
            logger.error(
                "tool_executor.get_target_group_knowledge.failed",
                error=str(exc),
                exc_info=True
            )
            return {
                "error": f"Failed to retrieve target group knowledge: {str(exc)}",
                "results": [],
                "count": 0
            }
    
    async def _get_document_content(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Execute get_document_content tool."""
        document_id = arguments.get("document_id", "")
        
        if not document_id:
            return {
                "error": "document_id is required",
                "content": "",
                "chunks": []
            }
        
        try:
            # Validate UUID format
            doc_uuid = UUID(document_id)
        except ValueError:
            return {
                "error": "Invalid document_id format (must be UUID)",
                "content": "",
                "chunks": []
            }
        
        try:
            # Get all chunks for this document from database
            with get_session() as session:
                chunks = session.scalars(
                    select(DocumentChunk)
                    .where(DocumentChunk.document_id == doc_uuid)
                    .order_by(DocumentChunk.chunk_metadata["order"].astext.cast(int).nulls_last())
                ).all()
                
                if not chunks:
                    return {
                        "error": "Document not found or has no chunks",
                        "content": "",
                        "chunks": []
                    }
                
                # Combine chunk content in order
                content_parts = []
                chunk_list = []
                
                for chunk in chunks:
                    chunk_content = chunk.content or ""
                    content_parts.append(chunk_content)
                    
                    chunk_list.append({
                        "chunk_id": str(chunk.id),
                        "content": chunk_content[:500],  # Limit for individual chunks
                        "metadata": chunk.chunk_metadata or {}
                    })
                
                full_content = "\n\n".join(content_parts)
                
                logger.info(
                    "tool_executor.get_document_content.complete",
                    document_id=document_id,
                    chunks_count=len(chunks)
                )
                
                return {
                    "content": full_content[:5000],  # Limit full content length
                    "chunks": chunk_list,
                    "chunks_count": len(chunks)
                }
        except Exception as exc:
            logger.error(
                "tool_executor.get_document_content.failed",
                error=str(exc),
                exc_info=True
            )
            return {
                "error": f"Failed to retrieve document content: {str(exc)}",
                "content": "",
                "chunks": []
            }

