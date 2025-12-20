"use client";

import { useMemo } from "react";
import { Box, Typography, Stack } from "@mui/material";
import { MsqdxGlassChatItem } from "./msqdx-glass-chat-item";
import type { ConversationSummary } from "../../lib/chat-history";

type ChatHistoryListProps = {
  conversations: ConversationSummary[];
  selectedPersonaId?: string;
  showArchived: boolean;
  searchQuery: string;
  onConversationSelect: (conversationId: string) => void;
  onConversationEdit: (conversationId: string, title: string) => void;
  onConversationArchive: (conversationId: string, archived: boolean) => void;
  onConversationDelete: (conversationId: string) => void;
};

export function MsqdxGlassChatHistoryList({
  conversations,
  selectedPersonaId,
  showArchived,
  searchQuery,
  onConversationSelect,
  onConversationEdit,
  onConversationArchive,
  onConversationDelete,
}: ChatHistoryListProps) {
  // Filter and sort conversations
  const filteredConversations = useMemo(() => {
    let filtered = [...conversations];

    // Filter by persona
    if (selectedPersonaId) {
      filtered = filtered.filter((conv) => conv.personaId === selectedPersonaId);
    }

    // Filter by archived status
    if (!showArchived) {
      filtered = filtered.filter((conv) => !conv.isArchived);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (conv) =>
          conv.title.toLowerCase().includes(query) ||
          conv.preview?.toLowerCase().includes(query) ||
          conv.personaName.toLowerCase().includes(query)
      );
    }

    // Sort by updatedAt (newest first)
    filtered.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    return filtered;
  }, [conversations, selectedPersonaId, showArchived, searchQuery]);

  if (filteredConversations.length === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          py: 8,
          px: 2,
        }}
      >
        <Typography variant="h6" sx={{ mb: 1, color: "text.secondary" }}>
          No conversations found
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary", textAlign: "center" }}>
          {searchQuery || selectedPersonaId
            ? "Try adjusting your filters or search query."
            : "Start a new conversation to see it here."}
        </Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={1.5}>
      {filteredConversations.map((conversation) => (
        <MsqdxGlassChatItem
          key={conversation.conversationId}
          conversation={conversation}
          onSelect={onConversationSelect}
          onEditTitle={onConversationEdit}
          onArchive={onConversationArchive}
          onDelete={onConversationDelete}
        />
      ))}
    </Stack>
  );
}

