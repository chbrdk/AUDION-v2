"""
Anthropic Tools/Functions definitions for Knowledge Base access.

These tools allow the LLM to dynamically query the knowledge base (Qdrant)
during chat conversations, enabling on-demand retrieval instead of
always loading all chunks upfront.
"""

from typing import Dict, Any, List

KNOWLEDGE_TOOLS: List[Dict[str, Any]] = [
    {
        "name": "search_knowledge",
        "description": "Search the knowledge base (Qdrant) for relevant research chunks using semantic search. Use this when you need to find information about a specific topic, persona, or subject.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query describing what information you're looking for"
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of results (default: 5, max: 20)",
                    "default": 5,
                    "minimum": 1,
                    "maximum": 20
                },
                "persona_segment": {
                    "type": "string",
                    "description": "Optional: Filter by persona segment for more relevant results",
                    "nullable": True
                }
            },
            "required": ["query"]
        }
    },
    {
        "name": "get_target_group_knowledge",
        "description": "Get all knowledge chunks associated with a target group. Use this when you need comprehensive knowledge about a specific target group.",
        "input_schema": {
            "type": "object",
            "properties": {
                "target_group_id": {
                    "type": "string",
                    "description": "UUID of the target group"
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of chunks to return (default: 10, max: 50)",
                    "default": 10,
                    "minimum": 1,
                    "maximum": 50
                }
            },
            "required": ["target_group_id"]
        }
    },
    {
        "name": "get_document_content",
        "description": "Get the full content of a specific document. Use this when you need detailed information from a known document.",
        "input_schema": {
            "type": "object",
            "properties": {
                "document_id": {
                    "type": "string",
                    "description": "UUID of the document"
                }
            },
            "required": ["document_id"]
        }
    }
]

