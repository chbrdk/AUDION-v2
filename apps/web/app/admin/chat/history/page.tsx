"use client";

// Disable static generation to prevent prerendering issues with useState/useContext
export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Stack,
  Typography,
} from "@mui/material";
import { MsqdxIcon } from "@msqdx/react";
import { useI18n } from "../../../../components/i18n/i18n-provider";
import { MsqdxGlassChatHistoryList } from "../../../../components/chat/msqdx-glass-chat-history-list";
import {
  loadConversationsFromLocalStorage,
  deleteConversationFromLocalStorage,
  archiveConversation,
  updateConversationTitle,
  type ConversationSummary,
} from "../../../../lib/chat-history";

export default function ChatHistoryPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>("");
  const [showArchived, setShowArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [availablePersonas, setAvailablePersonas] = useState<Array<{ id: string; name: string }>>([]);

  // Load conversations
  useEffect(() => {
    const loaded = loadConversationsFromLocalStorage(selectedPersonaId || undefined, showArchived);
    setConversations(loaded);
  }, [selectedPersonaId, showArchived]);

  // Load available personas from conversations
  useEffect(() => {
    const allConversations = loadConversationsFromLocalStorage(undefined, true);
    const uniquePersonas = Array.from(
      new Map(
        allConversations.map((conv) => [conv.personaId, { id: conv.personaId, name: conv.personaName }])
      ).values()
    );
    setAvailablePersonas(uniquePersonas);
  }, []);

  const handleConversationSelect = (conversationId: string) => {
    router.push(`/admin/chat?conversationId=${conversationId}`);
  };

  const handleConversationEdit = (conversationId: string, title: string) => {
    updateConversationTitle(conversationId, title);
    const loaded = loadConversationsFromLocalStorage(selectedPersonaId || undefined, showArchived);
    setConversations(loaded);
  };

  const handleConversationArchive = (conversationId: string, archived: boolean) => {
    archiveConversation(conversationId, archived);
    const loaded = loadConversationsFromLocalStorage(selectedPersonaId || undefined, showArchived);
    setConversations(loaded);
  };

  const handleConversationDelete = (conversationId: string) => {
    if (confirm(t("chatHistory.deleteConfirm"))) {
      deleteConversationFromLocalStorage(conversationId);
      const loaded = loadConversationsFromLocalStorage(selectedPersonaId || undefined, showArchived);
      setConversations(loaded);
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        p: 3,
        gap: 2,
      }}
    >
      {/* Header */}
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
          {t("chatHistory.title")}
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {t("chatHistory.subtitle")}
        </Typography>
      </Box>

      {/* Filters */}
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ flexShrink: 0 }}>
        <TextField
          fullWidth
          size="small"
          placeholder={t("chatHistory.searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <Box component="span" sx={{ mr: 1, opacity: 0.6, display: 'flex', alignItems: 'center' }}>
                <MsqdxIcon name="search" customSize={20} />
              </Box>
            ),
          }}
          sx={{ maxWidth: { md: 400 } }}
        />
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>{t("chatHistory.persona")}</InputLabel>
          <Select
            value={selectedPersonaId}
            onChange={(e) => setSelectedPersonaId(e.target.value)}
            label={t("chatHistory.persona")}
          >
            <MenuItem value="">{t("chatHistory.allPersonas")}</MenuItem>
            {availablePersonas.map((persona) => (
              <MenuItem key={persona.id} value={persona.id}>
                {persona.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControlLabel
          control={
            <Checkbox
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              size="small"
            />
          }
          label={t("chatHistory.showArchived")}
        />
      </Stack>

      {/* Conversation List */}
      <Box sx={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        <MsqdxGlassChatHistoryList
          conversations={conversations}
          selectedPersonaId={selectedPersonaId || undefined}
          showArchived={showArchived}
          searchQuery={searchQuery}
          onConversationSelect={handleConversationSelect}
          onConversationEdit={handleConversationEdit}
          onConversationArchive={handleConversationArchive}
          onConversationDelete={handleConversationDelete}
        />
      </Box>
    </Box>
  );
}
