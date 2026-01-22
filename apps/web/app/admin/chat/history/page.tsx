"use client";

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
  useTheme,
} from "@mui/material";
import { MaterialSymbol } from "../../../../components/material-symbol";
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
  const theme = useTheme();
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
    if (confirm("Are you sure you want to delete this conversation?")) {
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
          Chat History
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          View and manage your conversation history
        </Typography>
      </Box>

      {/* Filters */}
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ flexShrink: 0 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: <MaterialSymbol icon="search" fontSize={20} sx={{ mr: 1, opacity: 0.6 }} />,
          }}
          sx={{ maxWidth: { md: 400 } }}
        />
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Persona</InputLabel>
          <Select
            value={selectedPersonaId}
            onChange={(e) => setSelectedPersonaId(e.target.value)}
            label="Persona"
          >
            <MenuItem value="">All Personas</MenuItem>
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
          label="Show archived"
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
