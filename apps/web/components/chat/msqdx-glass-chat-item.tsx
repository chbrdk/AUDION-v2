"use client";

import { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  IconButton,
  Menu,
  MenuItem,
  Typography,
  useTheme,
  alpha,
  Avatar,
  Chip,
  Tooltip,
} from "@mui/material";
import { MsqdxIcon, MsqdxInput } from "@msqdx/react";
import type { ConversationSummary } from "../../lib/chat-history";
import { FORM_FIELD_ACCENT_SX } from "../../lib/theme-accent";

type ChatItemProps = {
  conversation: ConversationSummary;
  onSelect: (conversationId: string) => void;
  onEditTitle: (conversationId: string, newTitle: string) => void;
  onArchive: (conversationId: string, archived: boolean) => void;
  onDelete: (conversationId: string) => void;
};

export function MsqdxGlassChatItem({
  conversation,
  onSelect,
  onEditTitle,
  onArchive,
  onDelete,
}: ChatItemProps) {
  const theme = useTheme();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(conversation.title);
  const menuOpen = Boolean(menuAnchor);

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handleEditTitle = () => {
    setIsEditingTitle(true);
    setEditedTitle(conversation.title);
    handleMenuClose();
  };

  const handleSaveTitle = () => {
    if (editedTitle.trim() && editedTitle !== conversation.title) {
      onEditTitle(conversation.conversationId, editedTitle.trim());
    }
    setIsEditingTitle(false);
  };

  const handleCancelEdit = () => {
    setEditedTitle(conversation.title);
    setIsEditingTitle(false);
  };

  const handleArchive = () => {
    onArchive(conversation.conversationId, !conversation.isArchived);
    handleMenuClose();
  };

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete "${conversation.title}"?`)) {
      onDelete(conversation.conversationId);
    }
    handleMenuClose();
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return "Today";
    } else if (days === 1) {
      return "Yesterday";
    } else if (days < 7) {
      return `${days} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <Card
      onClick={() => onSelect(conversation.conversationId)}
      sx={{
        cursor: "pointer",
        transition: "all 0.2s ease",
        border: `1px solid var(--audion-light-border-color, #0f172a)`,
        borderRadius: "20px",
        backgroundColor: conversation.isArchived
          ? alpha(theme.palette.text.primary, 0.02)
          : "var(--color-neutral)",
        "&:hover": {
          backgroundColor: alpha(theme.palette.primary.main, 0.05),
          borderColor: theme.palette.primary.main,
          transform: "translateY(-2px)",
          boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.15)}`,
        },
      }}
    >
      <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
          {/* Avatar */}
          <Avatar
            sx={{
              width: 40,
              height: 40,
              bgcolor: theme.palette.primary.main,
              fontSize: "0.875rem",
            }}
          >
            {(conversation.personaName ?? "").charAt(0).toUpperCase() || "?"}
          </Avatar>

          {/* Content */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {/* Header with Title and Menu */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
              {isEditingTitle ? (
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <MsqdxInput
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    onBlur={handleSaveTitle}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSaveTitle();
                      } else if (e.key === "Escape") {
                        handleCancelEdit();
                      }
                    }}
                    autoFocus
                    size="small"
                    fullWidth
                    sx={FORM_FIELD_ACCENT_SX}
                  />
                </Box>
              ) : (
                <>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      flex: 1,
                      fontWeight: 600,
                      fontSize: "0.875rem",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {conversation.title}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={handleMenuClick}
                    sx={{
                      p: 0.5,
                      minWidth: "auto",
                      width: "24px",
                      height: "24px",
                    }}
                  >
                    <MsqdxIcon name="more_vert" customSize={16} />
                  </IconButton>
                </>
              )}
            </Box>

            {/* Preview */}
            {conversation.preview && (
              <Typography
                variant="body2"
                sx={{
                  fontSize: "0.75rem",
                  color: "text.secondary",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  mb: 1,
                }}
              >
                {conversation.preview}
              </Typography>
            )}

            {/* Metadata */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Chip
                  label={conversation.personaName}
                  size="small"
                  sx={{
                    height: "20px",
                    fontSize: "0.6875rem",
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    color: theme.palette.primary.main,
                  }}
                />
                {conversation.systemPrompt && (
                  <Tooltip
                    title={
                      <Box
                        sx={{
                          maxWidth: "400px",
                          maxHeight: "300px",
                          overflow: "auto",
                          p: 1,
                          whiteSpace: "pre-wrap",
                          fontSize: "0.75rem",
                          fontFamily: "monospace",
                          backgroundColor: "transparent",
                        }}
                      >
                        {conversation.systemPrompt}
                      </Box>
                    }
                    arrow
                    placement="top"
                    componentsProps={{
                      tooltip: {
                        sx: {
                          backgroundColor: "var(--color-neutral)",
                          border: "1px solid var(--audion-light-border-color, #0f172a)",
                          borderRadius: "8px",
                          maxWidth: "500px",
                          padding: 0,
                        },
                      },
                    }}
                  >
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      sx={{
                        p: 0.25,
                        width: "18px",
                        height: "18px",
                        color: "text.secondary",
                        "&:hover": {
                          color: "text.primary",
                        },
                      }}
                    >
                      <MsqdxIcon name="info" customSize={14} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
              <Typography variant="caption" sx={{ fontSize: "0.6875rem", color: "text.secondary" }}>
                {conversation.messageCount} messages
              </Typography>
              <Typography variant="caption" sx={{ fontSize: "0.6875rem", color: "text.secondary" }}>
                {formatDate(conversation.updatedAt)}
              </Typography>
              {conversation.isArchived && (
                <Chip
                  label="Archived"
                  size="small"
                  sx={{
                    height: "20px",
                    fontSize: "0.6875rem",
                    bgcolor: alpha(theme.palette.text.secondary, 0.1),
                    color: "text.secondary",
                  }}
                />
              )}
            </Box>
          </Box>
        </Box>
      </CardContent>

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={menuOpen}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
      >
        <MenuItem onClick={handleEditTitle}>
          <Box component="span" sx={{ mr: 1, display: "inline-flex", alignItems: "center" }}>
            <MsqdxIcon name="edit" customSize={16} />
          </Box>
          Edit Title
        </MenuItem>
        <MenuItem onClick={handleArchive}>
          <Box component="span" sx={{ mr: 1, display: "inline-flex", alignItems: "center" }}>
            <MsqdxIcon
              name={conversation.isArchived ? "unarchive" : "archive"}
              customSize={16}
            />
          </Box>
          {conversation.isArchived ? "Unarchive" : "Archive"}
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: "error.main" }}>
          <Box component="span" sx={{ mr: 1, display: "inline-flex", alignItems: "center" }}>
            <MsqdxIcon name="delete" customSize={16} />
          </Box>
          Delete
        </MenuItem>
      </Menu>
    </Card>
  );
}

