"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Typography,
  useTheme,
  IconButton,
  InputAdornment,
} from "@mui/material";
import { MaterialSymbol } from "../../../../components/material-symbol";
import { UdgGlassChatHistoryList } from "../../../../components/chat/udg-glass-chat-history-list";
import {
  loadConversationsFromLocalStorage,
  updateConversationTitle,
  archiveConversation,
  deleteConversationFromLocalStorage,
} from "../../../../lib/chat-history";
import type { ConversationSummary } from "../../../../lib/chat-history";

type PersonaSummary = {
  id: string;
  name: string;
  segment: string;
  headline: string;
  image_url?: string | null;
};

export default function ChatHistoryPage() {
  const theme = useTheme();
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [availablePersonas, setAvailablePersonas] = useState<PersonaSummary[]>([]);
  const [loadingPersonas, setLoadingPersonas] = useState(true);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | undefined>(undefined);
  const [showArchived, setShowArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Load personas
  useEffect(() => {
    const loadPersonas = async () => {
      try {
        const response = await fetch("/api/personas");
        if (response.ok) {
          const data = await response.json();
          // Handle both array and object with items property
          const personas = Array.isArray(data) ? data : (data.items || []);
          setAvailablePersonas(personas.map((p: any) => ({
            id: p.id,
            name: p.name,
            segment: p.segment || "",
            headline: p.headline || "",
            image_url: p.image_url,
          })));
        }
      } catch (error) {
        console.error("Failed to load personas:", error);
      } finally {
        setLoadingPersonas(false);
      }
    };

    loadPersonas();
  }, []);

  // Load conversations
  useEffect(() => {
    if (typeof window === "undefined") return;

    const loaded = loadConversationsFromLocalStorage(selectedPersonaId, showArchived);
    setConversations(loaded);
  }, [selectedPersonaId, showArchived]);

  const handleConversationSelect = (conversationId: string) => {
    router.push(`/admin/chat?conversationId=${conversationId}`);
  };

  const handleConversationEdit = (conversationId: string, title: string) => {
    updateConversationTitle(conversationId, title);
    // Reload conversations
    const loaded = loadConversationsFromLocalStorage(selectedPersonaId, showArchived);
    setConversations(loaded);
  };

  const handleConversationArchive = (conversationId: string, archived: boolean) => {
    archiveConversation(conversationId, archived);
    // Reload conversations
    const loaded = loadConversationsFromLocalStorage(selectedPersonaId, showArchived);
    setConversations(loaded);
  };

  const handleConversationDelete = (conversationId: string) => {
    deleteConversationFromLocalStorage(conversationId);
    // Reload conversations
    const loaded = loadConversationsFromLocalStorage(selectedPersonaId, showArchived);
    setConversations(loaded);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
  };

  return (
    <Box
      sx={{
        maxWidth: "1200px",
        mx: "auto",
        p: 3,
      }}
    >
      {/* Header */}
      <Box sx={{ mb: 2.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
          <MaterialSymbol icon="history" fontSize={24} />
          <Typography variant="h5" sx={{ fontWeight: 600, fontSize: "1.25rem" }}>
            Chat History
          </Typography>
        </Box>

        {/* Filters and Search */}
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
          {/* Search */}
          <TextField
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="small"
            sx={{
              flex: 1,
              minWidth: "180px",
              "& .MuiOutlinedInput-root": {
                borderRadius: 999,
                fontSize: "0.8125rem",
                height: "32px",
                "& input": {
                  py: "6px",
                  fontSize: "0.8125rem",
                },
              },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start" sx={{ ml: 0.5 }}>
                  <MaterialSymbol icon="search" fontSize={16} />
                </InputAdornment>
              ),
              endAdornment: searchQuery ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={handleClearSearch} sx={{ p: 0.25, width: "20px", height: "20px" }}>
                    <MaterialSymbol icon="close" fontSize={14} />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
          />

          {/* Persona Filter */}
          <FormControl size="small" sx={{ minWidth: "160px" }}>
            <InputLabel sx={{ fontSize: "0.8125rem" }}>Filter by Persona</InputLabel>
            <Select
              value={selectedPersonaId || ""}
              onChange={(e) => setSelectedPersonaId(e.target.value || undefined)}
              label="Filter by Persona"
              sx={{
                fontSize: "0.8125rem",
                height: "32px",
                borderRadius: 999,
                "& .MuiSelect-select": {
                  py: "6px",
                  fontSize: "0.8125rem",
                },
              }}
            >
              <MenuItem value="" sx={{ fontSize: "0.8125rem" }}>All Personas</MenuItem>
              {availablePersonas.map((persona) => (
                <MenuItem key={persona.id} value={persona.id} sx={{ fontSize: "0.8125rem" }}>
                  {persona.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Show Archived Toggle */}
          <FormControlLabel
            control={
              <Switch
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                size="small"
                sx={{
                  "& .MuiSwitch-switchBase": {
                    padding: "4px",
                  },
                }}
              />
            }
            label={
              <Typography variant="body2" sx={{ fontSize: "0.8125rem" }}>
                Show Archived
              </Typography>
            }
            sx={{ ml: 0.5, mr: 0 }}
          />
        </Box>
      </Box>

      {/* Conversation List */}
      <Box>
        <UdgGlassChatHistoryList
          conversations={conversations}
          selectedPersonaId={selectedPersonaId}
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

