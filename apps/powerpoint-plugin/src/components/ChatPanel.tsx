import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { ChatMessage, Persona, PluginSettings, SelectionMetadata } from '../types';
import { sendMessage } from '../api/audion-client';
import type { ChatRequest } from '../types';
import { t, Language } from '../translations';
import { generateConversationId } from '../services/conversation-service';

interface ChatPanelProps {
  selection: SelectionMetadata | null;
  selectedPersona: Persona | null;
  settings: PluginSettings | null;
  onMessageSent?: () => void;
  lang: Language;
}

export function ChatPanel({
  selection,
  selectedPersona,
  settings,
  onMessageSent,
  lang,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const conversationId = useMemo(() => {
    if (!selectedPersona) return null;
    const sid = selection?.nodeId ?? 'presentation';
    return generateConversationId(sid, selectedPersona.id);
  }, [selection?.nodeId, selectedPersona]);

  const usageUserId = settings?.usageUserId;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || !selectedPersona || !conversationId) {
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
      const request: ChatRequest = {
        persona_id: selectedPersona.id,
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
        ...(usageUserId ? { user_id: usageUserId } : {}),
        metadata: selection
          ? {
              selection,
              file_id: selection.fileId || selection.presentationId || selection.nodeId,
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div
        className="scroll-container"
        style={{
          flex: 1,
          padding: '4px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          marginBottom: '12px',
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              color: 'var(--msqdx-text-secondary)',
              textAlign: 'center',
              padding: '40px 20px',
              fontSize: '13px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div style={{ fontSize: '32px', opacity: 0.5 }}>✨</div>
            <div className="msqdx-mono" style={{ fontSize: '11px', fontWeight: '500' }}>
              {selectedPersona
                ? lang === 'de'
                  ? `CHATTE JETZT MIT ${selectedPersona.name.toUpperCase()}`
                  : `CHAT NOW WITH ${selectedPersona.name.toUpperCase()}`
                : lang === 'de'
                  ? 'WÄHLE EINE PERSONA AUS'
                  : 'SELECT A PERSONA'}
            </div>
          </div>
        )}

        {messages.map((message, index) => {
          const isUser = message.role === 'user';
          const labelColor = isUser ? 'var(--msqdx-orange, #ff6a3b)' : 'var(--msqdx-primary, #3b82f6)';
          const label = isUser
            ? lang === 'de'
              ? 'DU'
              : 'YOU'
            : selectedPersona?.name.toUpperCase() || 'PERSONA';

          return (
            <div
              key={index}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                alignItems: isUser ? 'flex-end' : 'flex-start',
                maxWidth: '90%',
                alignSelf: isUser ? 'flex-end' : 'flex-start',
              }}
            >
              <div className="msqdx-mono" style={{ fontSize: '9px', color: labelColor, fontWeight: '600' }}>
                {label}
              </div>
              <div
                style={{
                  padding: '16px 20px',
                  borderRadius: isUser ? '24px 8px 24px 24px' : '8px 24px 24px 24px',
                  backgroundColor: 'var(--msqdx-bg-card)',
                  color: 'var(--msqdx-text-main)',
                  fontSize: '13px',
                  lineHeight: '1.5',
                  wordWrap: 'break-word',
                  border: `1px solid var(--msqdx-border-color)`,
                  boxShadow: '0 2px 8px -2px rgba(15, 23, 42, 0.04)',
                }}
              >
                {message.content}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div
            className="loading-pulse"
            style={{
              alignSelf: 'flex-start',
              padding: '12px 20px',
              borderRadius: '12px 32px 32px 32px',
              backgroundColor: 'var(--msqdx-bg-card)',
              border: '1px solid var(--msqdx-border-color)',
              fontSize: '13px',
              color: 'var(--msqdx-text-secondary)',
            }}
          >
            <span className="msqdx-mono" style={{ fontSize: '10px' }}>
              {lang === 'de' ? 'DENKT NACH...' : 'THINKING...'}
            </span>
          </div>
        )}

        {error && (
          <div
            className="msqdx-mono"
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: 'rgba(220, 38, 38, 0.05)',
              border: '1px solid rgba(220, 38, 38, 0.15)',
              color: '#dc2626',
              fontSize: '10px',
              textAlign: 'center',
            }}
          >
            ERROR: {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div
        style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'flex-end',
          padding: '4px',
        }}
      >
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder={
            selectedPersona
              ? lang === 'de'
                ? `NACHRICHT AN ${selectedPersona.name.toUpperCase()}...`
                : `MESSAGE ${selectedPersona.name.toUpperCase()}...`
              : lang === 'de'
                ? 'PERSONA WÄHLEN...'
                : 'SELECT PERSONA...'
          }
          disabled={!selectedPersona || isLoading}
          rows={1}
          style={{
            flex: 1,
            padding: '12px 16px',
            background: 'rgba(15, 23, 42, 0.03)',
            border: '1px solid var(--msqdx-border-color)',
            borderRadius: '16px',
            fontSize: '13px',
            color: 'var(--msqdx-text-main)',
            outline: 'none',
            resize: 'none',
            maxHeight: '120px',
            fontFamily: 'inherit',
          }}
        />
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={!selectedPersona || !inputValue.trim() || isLoading}
          className="msqdx-button"
          style={{
            height: '42px',
            padding: '0 16px',
            borderRadius: '16px',
            flexShrink: 0,
            background:
              selectedPersona && inputValue.trim() ? 'var(--msqdx-primary)' : 'rgba(15, 23, 42, 0.05)',
            color: selectedPersona && inputValue.trim() ? 'white' : 'var(--msqdx-text-secondary)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path
              d="M22 2L15 22L11 13L2 9L22 2Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
