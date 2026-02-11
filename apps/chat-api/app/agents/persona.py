from __future__ import annotations

import json
from typing import Callable, List, Dict, Any, Optional

from openai import OpenAI
from msqdx_glass_proto import CompleteEvent, ContentDeltaEvent, SourcesEvent, ThinkingEvent

from ..core.config import get_settings

settings = get_settings()


class PersonaAgent:
    def __init__(self) -> None:
        if not settings.openai_api_key:
            raise RuntimeError("OpenAI API key not configured")
        self._openai = OpenAI(api_key=settings.openai_api_key)
        self._tool_executor = None  # Lazy load to avoid circular imports

    def stream_response(
        self,
        *,
        system_prompt: str,
        question: Optional[str] = None,
        messages: Optional[List[Dict[str, Any]]] = None,
        sources: List[dict] = None,
        persona_id: str = "",
        send_event: Callable = None,
        tools: Optional[List[Dict[str, Any]]] = None,
        persona_segment: Optional[str] = None,
        use_tools: bool = False,
    ) -> None:
        """
        Stream a persona response using OpenAI.
        
        Args:
            system_prompt: System prompt for OpenAI
            question: User question (legacy, use messages instead)
            messages: Optional list of messages (with images support)
            sources: Pre-retrieved sources (used if not using tools)
            persona_id: Persona ID
            send_event: Callback to send events
            tools: Optional list of tool definitions for OpenAI
            persona_segment: Optional persona segment for tool filtering
            use_tools: Whether to use tools instead of pre-retrieved sources
        """
        import structlog
        logger = structlog.get_logger(__name__)
        
        if sources is None:
            sources = []
        
        if use_tools and tools:
            logger.info("persona.agent.streaming_with_tools", persona_id=persona_id, tools_count=len(tools))
            self._stream_response_with_tools(
                system_prompt=system_prompt,
                question=question,
                messages=messages,
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
                # Convert sources to context
                sources_text = ""
                if sources:
                    sources_text = "\n\n".join([
                        f"[Source {i+1}]: {source.get('content', '')}"
                        for i, source in enumerate(sources[:5])
                    ])
                
                user_content = (
                    "Answer succinctly in natural, conversational language. "
                    "Avoid repeating words or phrases, do not include document IDs, chunk IDs, brackets, or the word 'doc'. "
                    "Keep the reply under 90 words and at most three short paragraphs unless the user explicitly asks for more detail. "
                    "Do not mention confidence scores, percentages, or meta commentary. "
                    "Avoid markdown formatting (no bold, bullets) unless the user requests it. "
                    "Share only the most relevant details, and go deeper only when it truly adds value. "
                    f"\n\nUser message: {question}"
                )
                
                if sources_text:
                    user_content += f"\n\nRelevant context:\n{sources_text}"
                
                stream = self._openai.chat.completions.create(
                    model="gpt-5-mini",
                    max_completion_tokens=600,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_content}
                    ],
                    stream=True,
                )
                
                for chunk in stream:
                    if chunk.choices and len(chunk.choices) > 0:
                        delta = chunk.choices[0].delta
                        if delta and delta.content:
                            aggregated += delta.content
                            send_event(
                                ContentDeltaEvent(
                                    persona_id=persona_id,
                                    delta=delta.content,
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

    def _convert_anthropic_tools_to_openai_functions(self, tools: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Convert Anthropic tool format to OpenAI function format."""
        functions = []
        for tool in tools:
            if "input_schema" in tool:
                functions.append({
                    "type": "function",
                    "function": {
                        "name": tool["name"],
                        "description": tool.get("description", ""),
                        "parameters": tool["input_schema"]
                    }
                })
        return functions

    def _stream_response_with_tools(
        self,
        *,
        system_prompt: str,
        question: Optional[str] = None,
        messages: Optional[List[Dict[str, Any]]] = None,
        persona_id: str = "",
        send_event: Callable = None,
        tools: List[Dict[str, Any]] = None,
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
            # Convert Anthropic tools to OpenAI functions
            functions = self._convert_anthropic_tools_to_openai_functions(tools)
            
            # Use provided messages if available (with image support), otherwise fall back to question
            if messages:
                # Messages already in OpenAI format (with images as arrays)
                messages = [
                    {"role": "system", "content": system_prompt}
                ] + messages
                
                # Debug: Log message structure for images
                for idx, msg in enumerate(messages):
                    content = msg.get("content", "")
                    is_list = isinstance(content, list)
                    if is_list:
                        image_count = sum(1 for block in content if isinstance(block, dict) and block.get("type") == "image_url")
                        logger.info("persona.agent.message_structure", 
                                   message_index=idx,
                                   role=msg.get("role"),
                                   content_is_list=True,
                                   content_length=len(content),
                                   image_count=image_count)
                    else:
                        logger.info("persona.agent.message_structure",
                                   message_index=idx,
                                   role=msg.get("role"),
                                   content_is_list=False,
                                   content_preview=str(content)[:100] if content else "")
            else:
                # Legacy: use question string
                messages = [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": question}
                ]
            
            max_iterations = 5  # Limit tool call iterations to prevent infinite loops
            iteration = 0
            
            while iteration < max_iterations:
                iteration += 1
                logger.info("persona.agent.tool_iteration", iteration=iteration, persona_id=persona_id)
                
                # Collect response and tool calls
                aggregated_text = ""
                tool_calls_this_iteration = []
                
                # Debug: Log message structure before API call
                for idx, msg in enumerate(messages):
                    content = msg.get("content", "")
                    is_list = isinstance(content, list)
                    if is_list:
                        image_count = sum(1 for block in content if isinstance(block, dict) and block.get("type") == "image_url")
                        logger.info("persona.agent.before_api_call", 
                                   message_index=idx,
                                   role=msg.get("role"),
                                   content_is_list=True,
                                   content_length=len(content),
                                   image_count=image_count)
                    else:
                        logger.info("persona.agent.before_api_call",
                                   message_index=idx,
                                   role=msg.get("role"),
                                   content_is_list=False,
                                   content_preview=str(content)[:100] if content else "")
                
                logger.info("persona.agent.openai_call_starting", model="gpt-5-mini", has_tools=bool(functions), messages_count=len(messages))
                try:
                    stream = self._openai.chat.completions.create(
                        model="gpt-5-mini",
                        max_completion_tokens=4000,
                        messages=messages,
                        tools=functions if functions else None,
                        stream=True,
                    )
                    logger.info("persona.agent.openai_stream_created")
                except Exception as e:
                    logger.error("persona.agent.openai_call_failed", error=str(e), error_type=type(e).__name__, exc_info=True)
                    raise
                

                
                for chunk in stream:
                    if not chunk.choices or len(chunk.choices) == 0:
                        continue
                    
                    choice = chunk.choices[0]
                    delta = choice.delta
                    finish_reason = choice.finish_reason
                    
                    if delta and delta.content:
                        aggregated_text += delta.content
                        send_event(
                            ContentDeltaEvent(
                                persona_id=persona_id,
                                delta=delta.content,
                            )
                        )
                    
                    if delta and delta.tool_calls:
                        for tool_call_delta in delta.tool_calls:
                            if tool_call_delta.index is not None:
                                # Ensure we have enough entries in tool_calls_this_iteration
                                while len(tool_calls_this_iteration) <= tool_call_delta.index:
                                    tool_calls_this_iteration.append({
                                        "id": "",
                                        "name": "",
                                        "arguments": ""
                                    })
                                
                                tool_call = tool_calls_this_iteration[tool_call_delta.index]
                                
                                if tool_call_delta.id:
                                    tool_call["id"] = tool_call_delta.id
                                    tool_call["id"] = tool_call_delta.id
                                
                                if tool_call_delta.function:
                                    if tool_call_delta.function.name:
                                        tool_call["name"] = tool_call_delta.function.name
                                        tool_call["name"] = tool_call_delta.function.name
                                    if tool_call_delta.function.arguments:
                                        tool_call["arguments"] += tool_call_delta.function.arguments
                                        tool_call["arguments"] += tool_call_delta.function.arguments
                    
                    # Check finish_reason to see if stream is complete
                    if finish_reason:
                        logger.debug("persona.agent.stream_finished", finish_reason=finish_reason, has_text=bool(aggregated_text), has_tool_calls=bool(tool_calls_this_iteration))
                
                # Check if we have tool calls to execute
                if tool_calls_this_iteration and any(tc.get("name") for tc in tool_calls_this_iteration):
                    # Execute all tool calls
                    for tool_call in tool_calls_this_iteration:
                        if not tool_call.get("name"):
                            continue
                        
                        tool_name = tool_call["name"]
                        tool_arguments_str = tool_call.get("arguments", "{}")
                        
                        try:
                            tool_arguments = json.loads(tool_arguments_str) if tool_arguments_str else {}
                        except json.JSONDecodeError as e:
                            logger.warning("persona.agent.tool_input_parse_failed", tool_name=tool_name, error=str(e))
                            tool_arguments = {}
                        
                        logger.info("persona.agent.tool_call_execute", tool_name=tool_name, arguments_keys=list(tool_arguments.keys()))
                        
                        # Execute tool
                        try:
                            tool_result = asyncio.run(
                                self._tool_executor.execute_tool(tool_name, tool_arguments, persona_segment)
                            )
                        except RuntimeError as e:
                            logger.warning("persona.agent.tool_execution_event_loop_error", error=str(e))
                            import concurrent.futures
                            with concurrent.futures.ThreadPoolExecutor() as executor:
                                future = executor.submit(
                                    lambda: asyncio.run(
                                        self._tool_executor.execute_tool(tool_name, tool_arguments, persona_segment)
                                    )
                                )
                                tool_result = future.result(timeout=30)
                        
                        # Add tool call and result to messages
                        messages.append({
                            "role": "assistant",
                            "tool_calls": [{
                                "id": tool_call["id"],
                                "type": "function",
                                "function": {
                                    "name": tool_name,
                                    "arguments": tool_arguments_str
                                }
                            }]
                        })
                        messages.append({
                            "role": "tool",
                            "tool_call_id": tool_call["id"],
                            "content": json.dumps(tool_result, ensure_ascii=False)
                        })
                        
                        logger.info("persona.agent.tool_result_added", tool_name=tool_name)
                    
                    # Continue loop to get final response
                    continue
                
                # No tool calls - we're done
                if aggregated_text:
                    logger.info("persona.agent.final_response", text_length=len(aggregated_text))
                    break
                else:
                    logger.warning("persona.agent.no_response", iteration=iteration)
                    break
            
            send_event(CompleteEvent(persona_id=persona_id, latency_ms=0))
            
        except Exception as e:
            logger.error("persona.agent.tool_stream_failed", error=str(e), exc_info=True)
            send_event(ThinkingEvent(status=f"Error generating response: {str(e)}"))
            send_event(CompleteEvent(persona_id=persona_id, latency_ms=0))
