'use client';

import { MsqdxCard, MsqdxTypography, MsqdxIcon, MsqdxChip } from '@msqdx/react';
import { Box } from '@mui/material';

export type ChatConversation = {
  conversationId: string;
  title: string;
  updatedAt: Date;
  messageCount: number;
};

export type ChatItemProps = {
  conversation: ChatConversation;
  onSelect: (id: string) => void;
};

function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString();
}

export function ChatItem({ conversation, onSelect }: ChatItemProps) {
  return (
    <MsqdxCard
      sx={{ p: 1.5, cursor: 'pointer' }}
      onClick={() => onSelect(conversation.conversationId)}
    >
      <Box display="flex" alignItems="flex-start" gap={1}>
        <MsqdxIcon name="forum" size="sm" sx={{ mt: 0.25 }} />
        <Box flex={1} minWidth={0}>
          <MsqdxTypography variant="body2" fontWeight={500} noWrap>
            {conversation.title}
          </MsqdxTypography>
          <Box display="flex" alignItems="center" gap={1} mt={0.5}>
            <MsqdxTypography variant="caption" color="text.secondary">
              {formatDate(conversation.updatedAt)}
            </MsqdxTypography>
            <MsqdxChip label={`${conversation.messageCount} messages`} size="small" />
          </Box>
        </Box>
      </Box>
    </MsqdxCard>
  );
}
