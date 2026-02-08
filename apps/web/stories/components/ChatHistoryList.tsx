'use client';

import { ChatItem, type ChatConversation } from './ChatItem';
import { MsqdxTypography, MsqdxScrollbar } from '@msqdx/react';
import { Box } from '@mui/material';

export type ChatHistoryListProps = {
  conversations: ChatConversation[];
  onSelect: (id: string) => void;
  emptyMessage?: string;
};

export function ChatHistoryList({
  conversations,
  onSelect,
  emptyMessage = 'No conversations yet.',
}: ChatHistoryListProps) {
  return (
    <MsqdxScrollbar sx={{ maxHeight: 400 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: 1 }}>
        {conversations.length === 0 ? (
          <Box sx={{ py: 4, px: 2, textAlign: 'center' }}>
            <MsqdxTypography variant="body2" color="text.secondary">
              {emptyMessage}
            </MsqdxTypography>
          </Box>
        ) : (
          conversations.map((conv) => (
            <ChatItem key={conv.conversationId} conversation={conv} onSelect={onSelect} />
          ))
        )}
      </Box>
    </MsqdxScrollbar>
  );
}
