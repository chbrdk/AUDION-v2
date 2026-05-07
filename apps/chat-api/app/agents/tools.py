"""
Anthropic-style tool/function definitions for the persona chat.

`KNOWLEDGE_TOOLS` are read-only retrieval tools (Qdrant / DB) that the persona
LLM may call to ground its answer in stored research.

`ACTION_TOOLS` are tools that produce side effects in the broader product —
currently a single `inspect_website` tool that hands off to the
`apps/ux-journey-agent` service to actually visit a page in a real browser as
the persona. The orchestrator (see `app/routers/chat.py`) merges both lists
when `chat_action_tools_enabled` is true.
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


ACTION_TOOLS: List[Dict[str, Any]] = [
    {
        "name": "inspect_website",
        "description": (
            "Open a website in a real browser as this persona and report what "
            "you experience. Use ONLY when the user explicitly asks you to look "
            "at, browse, evaluate or navigate a specific URL or named site "
            "(e.g. \"Schau dir Porsche.de an\", \"Check out the Taycan product page\"). "
            "Do NOT call this for general questions answerable from your own "
            "knowledge or retrieval tools. Never invent URLs — if the user "
            "mentions only a brand without a URL and you are not sure, ask back. "
            "After this tool returns, summarize what you (as this persona) "
            "experienced in first person, in the persona's voice and language."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "Absolute URL to inspect, e.g. https://porsche.de/taycan",
                },
                "task": {
                    "type": "string",
                    "description": (
                        "Short, persona-flavored objective for the visit "
                        "(e.g. 'Find the Taycan configurator and check pricing for a sporty trim')."
                    ),
                },
                "max_steps": {
                    "type": "integer",
                    "description": "Optional cap on browser steps (default 12).",
                    "default": 12,
                    "minimum": 3,
                    "maximum": 30,
                },
            },
            "required": ["url", "task"],
        },
    }
]

