import React, { useState, useEffect, useRef } from 'react';
import type { ChatMessage, Persona } from '../types';
import { sendMessage, uploadImage } from '../api/audion-client';
import type { ChatRequest } from '../types';

interface ChatPanelProps {
  persona: Persona | null;
  conversationId: string | null;
  selectionMetadata: any;
  screenshot?: string | null;
  onMessageSent?: () => void;
}

export function ChatPanel({
  persona,
  conversationId,
  selectionMetadata,
  screenshot,
  onMessageSent,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || !persona || !conversationId) {
      return;
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: inputValue,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setError(null);

    try {
      // Upload screenshot if available
      let imageIds: string[] | undefined;
      if (screenshot) {
        try {
          const imageId = await uploadImage(screenshot);
          imageIds = [imageId];
        } catch (error) {
          console.warn('Failed to upload screenshot, continuing without image:', error);
        }
      }

      const request: ChatRequest = {
        persona_id: persona.id,
        messages: [
          ...messages.map((m) => ({
            role: m.role as 'user' | 'assistant' | 'system',
            content: m.content,
            image_ids: m.imageIds,
          })),
          {
            role: 'user',
            content: inputValue,
            image_ids: imageIds,
          },
        ],
        conversation_id: conversationId,
        metadata: selectionMetadata
          ? {
              selection: selectionMetadata,
              figma_file_id: selectionMetadata.nodeId,
            }
          : undefined,
      };

      const response = await sendMessage(request);

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.response,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      onMessageSent?.();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
      console.error('Chat error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              color: '#666',
              textAlign: 'center',
              padding: '20px',
              fontSize: '14px',
            }}
          >
            {persona
              ? `Start chatting with ${persona.name} about your selection`
              : 'Select a persona to start chatting'}
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            style={{
              alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '80%',
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor:
                message.role === 'user' ? '#0d99ff' : '#f0f0f0',
              color: message.role === 'user' ? '#fff' : '#000',
              fontSize: '14px',
              wordWrap: 'break-word',
            }}
          >
            {message.content}
          </div>
        ))}

        {isLoading && (
          <div
            style={{
              alignSelf: 'flex-start',
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: '#f0f0f0',
              fontSize: '14px',
            }}
          >
            Thinking...
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: '#ffebee',
              color: '#c62828',
              fontSize: '14px',
            }}
          >
            Error: {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div
        style={{
          borderTop: '1px solid #e0e0e0',
          padding: '12px',
          display: 'flex',
          gap: '8px',
        }}
      >
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={
            persona ? 'Type your message...' : 'Select a persona first'
          }
          disabled={!persona || isLoading}
          style={{
            flex: 1,
            padding: '8px',
            border: '1px solid #e0e0e0',
            borderRadius: '4px',
            fontSize: '14px',
          }}
        />
        <button
          onClick={handleSend}
          disabled={!persona || !inputValue.trim() || isLoading}
          style={{
            padding: '8px 16px',
            backgroundColor: persona ? '#0d99ff' : '#ccc',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: persona && inputValue.trim() ? 'pointer' : 'not-allowed',
            fontSize: '14px',
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

