from __future__ import annotations

import json
from typing import Callable, List, Dict, Any, Optional

from anthropic import Anthropic
from msqdx_glass_proto import CompleteEvent, ContentDeltaEvent, SourcesEvent, ThinkingEvent

from ..core.config import get_settings
from ..utils.text import clean_response_text

settings = get_settings()


class PersonaAgent:
    def __init__(self) -> None:
        self._anthropic = Anthropic(api_key=settings.anthropic_api_key)
        self._tool_executor = None  # Lazy load to avoid circular imports

    def stream_response(
        self,
        *,
        system_prompt: str,
        question: str,
        sources: List[dict],
        persona_id: str,
        send_event: Callable,
        tools: Optional[List[Dict[str, Any]]] = None,
        persona_segment: Optional[str] = None,
        use_tools: bool = False,
    ) -> None:
        """
        Stream a persona response using Claude.
        
        Args:
            system_prompt: System prompt for Claude
            question: User question
            sources: Pre-retrieved sources (used if not using tools)
            persona_id: Persona ID
            send_event: Callback to send events
            tools: Optional list of tool definitions for Anthropic
            persona_segment: Optional persona segment for tool filtering
            use_tools: Whether to use tools instead of pre-retrieved sources
        """
        import structlog
        logger = structlog.get_logger(__name__)
        
        if use_tools and tools:
            logger.info("persona.agent.streaming_with_tools", persona_id=persona_id, tools_count=len(tools))
            self._stream_response_with_tools(
                system_prompt=system_prompt,
                question=question,
                persona_id=persona_id,
                send_event=send_event,
                tools=tools,
                persona_segment=persona_segment,
            )
        else:
            logger.info("persona.agent.streaming_start", persona_id=persona_id, question_length=len(question), sources_count=len(sources))
            send_event(ThinkingEvent(status="Retrieving evidence…"))
            
            aggregated = ""
            try:
                # Use stream as context manager (required for Anthropic MessageStreamManager)
                # Create stream directly in with statement
                with self._anthropic.messages.stream(
                    model="claude-haiku-4-5-20251001",
                    max_tokens=600,
                    temperature=0.4,
                    system=system_prompt,
                    messages=[
                        {
                            "role": "user",
                            "content": (
                                "Answer succinctly in natural, conversational language. "
                                "Avoid repeating words or phrases, do not include document IDs, chunk IDs, brackets, or the word 'doc'. "
                                "Keep the reply under 90 words and at most three short paragraphs unless the user explicitly asks for more detail. "
                                "Do not mention confidence scores, percentages, or meta commentary. "
                                "Avoid markdown formatting (no bold, bullets) unless the user requests it. "
                                "Share only the most relevant details, and go deeper only when it truly adds value. "
                                f"User message: {question}"
                            ),
                        }
                    ],
                ) as stream:
                    for event in stream:
                        if event.type == "content_block_delta":
                            delta_text = getattr(event.delta, "text", None)
                            if delta_text is None and isinstance(event.delta, dict):
                                delta_text = event.delta.get("text", "")
                            if not delta_text:
                                continue
                            aggregated += delta_text
                            send_event(
                                ContentDeltaEvent(
                                    persona_id=persona_id,
                                    delta=delta_text,
                                )
                            )
            except Exception as e:
                logger.error("persona.agent.stream_failed", error=str(e), exc_info=True)
                send_event(ThinkingEvent(status=f"Error generating response: {str(e)}"))
                return
            
            send_event(
                SourcesEvent(
                    persona_id=persona_id,
                    sources=[
                        {
                            "chunk_id": source["chunk_id"],
                            "document_id": source["document_id"],
                            "title": source.get("title", "Research"),
                            "confidence": source.get("confidence", 0.8),
                            "excerpt": source.get("content", "")[:320],
                        }
                        for source in sources[:5]
                    ],
                )
            )
            send_event(CompleteEvent(persona_id=persona_id, latency_ms=0))

    def _stream_response_with_tools(
        self,
        *,
        system_prompt: str,
        question: str,
        persona_id: str,
        send_event: Callable,
        tools: List[Dict[str, Any]],
        persona_segment: Optional[str] = None,
    ) -> None:
        """Stream response with tool support."""
        import structlog
        import asyncio
        logger = structlog.get_logger(__name__)
        
        # Lazy load tool executor
        if self._tool_executor is None:
            from ..agents.tool_executor import ToolExecutor
            self._tool_executor = ToolExecutor()
        
        send_event(ThinkingEvent(status="Thinking…"))
        
        try:
            messages = [
                {
                    "role": "user",
                    "content": question,
                }
            ]
            
            max_iterations = 5  # Limit tool call iterations to prevent infinite loops
            iteration = 0
            
            while iteration < max_iterations:
                iteration += 1
                logger.info("persona.agent.tool_iteration", iteration=iteration, persona_id=persona_id)
                
                # Collect response and tool calls
                aggregated_text = ""
                tool_calls = []
                current_tool_call_id = None
                current_tool_name = None
                current_tool_input = ""
                
                # Use stream as context manager (required for Anthropic MessageStreamManager)
                # Create stream directly in with statement
                # Increased max_tokens to 64000 for tool calls (tools need more tokens for proper JSON arguments and responses)
                # Maximum allowed for Sonnet 4.5 is 64K tokens
                # Use Sonnet for tool calls for better tool support (Haiku may have limitations)
                with self._anthropic.messages.stream(
                    model="claude-sonnet-4-5-20250929",  # Use Sonnet 4.5 for better tool support
                    max_tokens=64000,
                    temperature=0.4,
                    system=system_prompt,
                    messages=messages,
                    tools=tools,
                ) as stream:
                    for event in stream:
                        # Log all events to understand what's happening (only debug level to reduce noise)
                        logger.debug("persona.agent.event", event_type=event.type, has_delta=hasattr(event, "delta"), has_content_block=hasattr(event, "content_block"), has_index=hasattr(event, "index"))
                        
                        if event.type == "content_block_start":
                            content_block = event.content_block
                            if hasattr(content_block, "type") and getattr(content_block, "type") == "tool_use":
                                current_tool_call_id = getattr(content_block, "id", None)
                                current_tool_name = getattr(content_block, "name", None)
                                # Check if input is already available in content_block
                                if hasattr(content_block, "input") and content_block.input:
                                    current_tool_input = content_block.input
                                    logger.info("persona.agent.tool_call_start", tool_name=current_tool_name, tool_id=current_tool_call_id, input_initial=len(current_tool_input))
                                else:
                                    current_tool_input = ""
                                    logger.info("persona.agent.tool_call_start", tool_name=current_tool_name, tool_id=current_tool_call_id)
                        elif event.type == "content_block_delta":
                            # Check for text delta
                            delta_text = getattr(event.delta, "text", None)
                            if delta_text:
                                # Text content
                                aggregated_text += delta_text
                                send_event(
                                    ContentDeltaEvent(
                                        persona_id=persona_id,
                                        delta=delta_text,
                                    )
                                )
                            
                            # Check for tool input delta - use getattr instead of hasattr
                            # Tool input deltas come as event.delta.input (raw JSON string chunks)
                            delta_input = getattr(event.delta, "input", None)
                            if delta_input:
                                if current_tool_call_id is None:
                                    logger.warning("persona.agent.tool_input_no_id", delta_preview=str(delta_input)[:50], event_index=getattr(event, "index", None))
                                else:
                                    # Input comes as raw JSON string chunks, accumulate them
                                    current_tool_input += str(delta_input)
                                    logger.info("persona.agent.tool_input_delta", tool_name=current_tool_name, tool_id=current_tool_call_id, delta_preview=str(delta_input)[:50], total_length=len(current_tool_input))
                        elif event.type == "input_json":
                            # Anthropic SDK sends separate input_json events for tool input deltas
                            # These events have a 'partial_json' attribute containing the JSON string chunk
                            partial_json = getattr(event, "partial_json", None)
                            
                            if partial_json and current_tool_call_id:
                                # partial_json contains the JSON string chunk, accumulate it
                                current_tool_input += partial_json
                                logger.debug("persona.agent.input_json_event", tool_name=current_tool_name, tool_id=current_tool_call_id, json_preview=partial_json[:50], total_length=len(current_tool_input))
                            elif partial_json:
                                logger.warning("persona.agent.input_json_no_tool_id", json_preview=partial_json[:50])
                        elif event.type == "text":
                            # Text events might be duplicates of content_block_delta events
                            # Only process if we haven't already processed this text via content_block_delta
                            # Skip to avoid duplicate deltas - text is already sent via content_block_delta
                            pass
                        elif event.type == "message_stop":
                            # Message complete - check if we have tool calls
                            if tool_calls:
                                break
                
                # If we have tool calls, execute them and continue
                if current_tool_call_id and current_tool_name:
                    try:
                        # Parse tool input JSON
                        logger.info("persona.agent.tool_call_parse", tool_name=current_tool_name, tool_input_preview=current_tool_input[:100] if current_tool_input else "EMPTY")
                        tool_arguments = {}
                        if current_tool_input:
                            try:
                                tool_arguments = json.loads(current_tool_input)
                            except json.JSONDecodeError as e:
                                logger.warning("persona.agent.tool_input_parse_failed", tool_name=current_tool_name, error=str(e), input_preview=current_tool_input[:200])
                                # Try to extract query from malformed JSON
                                if "query" in current_tool_input.lower():
                                    # Fallback: try to extract query manually
                                    import re
                                    query_match = re.search(r'"query"\s*:\s*"([^"]+)"', current_tool_input)
                                    if query_match:
                                        tool_arguments = {"query": query_match.group(1)}
                        else:
                            logger.warning("persona.agent.tool_input_empty", tool_name=current_tool_name, tool_id=current_tool_call_id)
                        
                        tool_calls.append({
                            "id": current_tool_call_id,
                            "name": current_tool_name,
                            "arguments": tool_arguments,
                        })
                        
                        logger.info("persona.agent.tool_call_execute", tool_name=current_tool_name, arguments_keys=list(tool_arguments.keys()), arguments=tool_arguments)
                        
                        # Execute tool - simplified async execution
                        # Since we're in a sync context but need async, use asyncio.run
                        # This is cleaner than the previous complex event loop handling
                        try:
                            tool_result = asyncio.run(
                                self._tool_executor.execute_tool(current_tool_name, tool_arguments, persona_segment)
                            )
                        except RuntimeError as e:
                            # If event loop is already running, we need to handle it differently
                            # This should not happen in normal flow, but handle gracefully
                            logger.warning("persona.agent.tool_execution_event_loop_error", error=str(e))
                            # Fallback: create new event loop in thread
                            import concurrent.futures
                            with concurrent.futures.ThreadPoolExecutor() as executor:
                                future = executor.submit(
                                    lambda: asyncio.run(
                                        self._tool_executor.execute_tool(current_tool_name, tool_arguments, persona_segment)
                                    )
                                )
                                tool_result = future.result(timeout=30)  # Increased timeout for safety
                        
                        # Add tool result to messages
                        messages.append({
                            "role": "assistant",
                            "content": [
                                {
                                    "type": "tool_use",
                                    "id": current_tool_call_id,
                                    "name": current_tool_name,
                                    "input": tool_arguments,
                                }
                            ],
                        })
                        messages.append({
                            "role": "user",
                            "content": [
                                {
                                    "type": "tool_result",
                                    "tool_use_id": current_tool_call_id,
                                    "content": json.dumps(tool_result, ensure_ascii=False),
                                }
                            ],
                        })
                        
                        logger.info("persona.agent.tool_result_added", tool_name=current_tool_name)
                        continue  # Continue loop to get final response
                    except Exception as exc:
                        logger.error("persona.agent.tool_execution_failed", error=str(exc), exc_info=True)
                        # Continue anyway - let LLM handle the error
                
                # No more tool calls - we're done
                # If we have aggregated text, send it; otherwise we'll continue to get final response
                if aggregated_text:
                    logger.info("persona.agent.final_response", text_length=len(aggregated_text))
                    break
                if not tool_calls and not current_tool_call_id:
                    # No tool calls were made, but also no text - something went wrong
                    logger.warning("persona.agent.no_response", iteration=iteration)
                    break
            
            # After all iterations, if we have aggregated text from final response, send it
            if aggregated_text:
                logger.info("persona.agent.final_response_sent", text_length=len(aggregated_text))
            else:
                logger.warning("persona.agent.no_final_text", iteration=iteration)
            
            # Send sources if any tool results were knowledge searches
            # For now, we'll skip sources when using tools as they're handled dynamically
            send_event(CompleteEvent(persona_id=persona_id, latency_ms=0))
            
        except Exception as e:
            logger.error("persona.agent.tool_stream_failed", error=str(e), exc_info=True)
            send_event(ThinkingEvent(status=f"Error generating response: {str(e)}"))
            send_event(CompleteEvent(persona_id=persona_id, latency_ms=0))

