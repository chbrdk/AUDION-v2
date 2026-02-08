'use client';

import { useRef, useEffect } from 'react';
import { MsqdxCard, MsqdxTypography } from '@msqdx/react';
import { Box } from '@mui/material';

export type ChatMessage = {
  id: string;
  role: 'user' | 'persona' | 'system';
  content: string;
  personaName?: string;
};

export type ChatPanelProps = { messages: ChatMessage[] };

export function ChatPanel({ messages }: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <Box sx={{ height: 320, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {messages.map((msg) => {
        const isUser = msg.role === 'user';
        const label = msg.role === 'user' ? 'You' : msg.role === 'persona' ? (msg.personaName ?? 'Persona') : 'System';
        return (
          <Box key={msg.id} sx={{ alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
            <MsqdxTypography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              {label}
            </MsqdxTypography>
            <MsqdxCard
              sx={{
                p: 1.5,
                borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                bgcolor: isUser ? 'primary.main' : 'background.paper',
                color: isUser ? 'primary.contrastText' : 'text.primary',
              }}
            >
              <MsqdxTypography variant="body2">{msg.content}</MsqdxTypography>
            </MsqdxCard>
          </Box>
        );
      })}
      <div ref={bottomRef} />
    </Box>
  );
}
