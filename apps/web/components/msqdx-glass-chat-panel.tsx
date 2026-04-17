"use client";

import { useEffect, useRef } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  alpha,
  Box,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import { keyframes } from "@emotion/react";
import { MsqdxIcon } from "@msqdx/react";
import { ChatMessageMarkdown } from "./chat/chat-message-markdown";
import { glassChatPanelMessagesStackSx } from "../lib/glass-chat-panel-layout";
import { systemPromptTooltipContentSx } from "../lib/system-prompt-tooltip-content-sx";
import { useI18n } from "./i18n/i18n-provider";

type Message = {
  id: string;
  role: "user" | "persona" | "system";
  content: string;
  personaName?: string;
  images?: string[]; // Base64 data URLs for images
  /** Filenames for DOCX attached to this message (text lives on server until TTL). */
  document_attachment_meta?: Array<{ id: string; filename: string }>;
  /** Optional model reasoning stream (collapsible in UI). */
  reasoning?: string;
};

type MsqdxGlassChatPanelProps = {
  messages: Message[];
  systemPrompt?: string; // Optional: System prompt to display in tooltip
};

export const MsqdxGlassChatPanel = ({ messages, systemPrompt }: MsqdxGlassChatPanelProps) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const { t } = useI18n();

  const USER_BORDER = "var(--color-secondary-dx-orange)";
  const PERSONA_BORDER = "var(--color-secondary-dx-pink)";
  const SYSTEM_BORDER = "var(--color-secondary-dx-grey-light)";

  const bubbleEnter = keyframes`
    from {
      opacity: 0;
      transform: translateY(8px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  `;

  const textFade = keyframes`
    from {
      opacity: 0.7;
    }
    to {
      opacity: 1;
    }
  `;

  const getBubbleStyles = (role: Message["role"]) => {
    const isDark = theme.palette.mode === "dark";
    if (role === "user") {
      return {
        alignSelf: "flex-end",
        background: theme.palette.background.paper,
        border: `1px solid ${USER_BORDER}`,
        borderRadius: "36px 12px 36px 36px",
        color: theme.palette.text.primary
      };
    }
    if (role === "system") {
      return {
        alignSelf: "flex-start",
        background: isDark
          ? alpha(theme.palette.background.paper, 0.5)
          : alpha("#000000", 0.03),
        border: `1px solid ${SYSTEM_BORDER}`,
        borderRadius: "16px 44px 44px 44px",
        color: theme.palette.text.primary
      };
    }
    return {
      alignSelf: "flex-start",
      background: theme.palette.background.paper,
      border: `1px solid ${PERSONA_BORDER}`,
      borderRadius: "12px 44px 44px 44px",
      color: theme.palette.text.primary
    };
  };

  const getLabelColor = (role: Message["role"]) => {
    if (role === "user") return USER_BORDER;
    if (role === "system") return SYSTEM_BORDER;
    return PERSONA_BORDER;
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <Box sx={{ width: "100%" }}>
      <Stack spacing={3} sx={glassChatPanelMessagesStackSx}>
        {messages.map((message) => {
          const bubbleStyles = getBubbleStyles(message.role);
          const label =
            message.role === "user"
              ? "You"
              : message.role === "persona"
              ? message.personaName ?? "Persona"
              : "System";

          return (
            <Stack
              key={message.id}
              spacing={0.5}
              alignItems={bubbleStyles.alignSelf === "flex-end" ? "flex-end" : "flex-start"}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Typography
                  variant="caption"
                  sx={{
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    color: getLabelColor(message.role)
                  }}
                >
                  {label}
                </Typography>
                {message.role === "persona" && systemPrompt && (
                  <Tooltip
                    title={
                      <Box sx={systemPromptTooltipContentSx}>
                        {systemPrompt}
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
                      sx={{
                        p: 0.25,
                        width: "18px",
                        height: "18px",
                        color: getLabelColor(message.role),
                        opacity: 0.7,
                        "&:hover": {
                          opacity: 1,
                        },
                      }}
                    >
                      <MsqdxIcon name="info" customSize={14} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
              <Box
                sx={{
                  ...bubbleStyles,
                  paddingLeft: "32px",
                  paddingRight: "32px",
                  paddingTop: "28px",
                  paddingBottom: "32px",
                  maxWidth: { xs: "100%", md: "80%" },
                  animation: `${bubbleEnter} 280ms ease`,
                  transition: "transform 200ms ease"
                }}
              >
                <Box
                  key={message.id}
                  sx={{
                    color: theme.palette.text.primary,
                    animation: `${textFade} 220ms ease`,
                    opacity: 1,
                  }}
                >
                  {message.role === "persona" && message.reasoning?.trim() ? (
                    <Accordion
                      disableGutters
                      elevation={0}
                      sx={{
                        mb: 1.5,
                        bgcolor: "transparent",
                        "&:before": { display: "none" },
                      }}
                    >
                      <AccordionSummary
                        expandIcon={<MsqdxIcon name="expand_more" customSize={16} />}
                        sx={{ px: 0, minHeight: 40, "& .MuiAccordionSummary-content": { my: 0.5 } }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            letterSpacing: 1,
                            textTransform: "uppercase",
                            color: theme.palette.text.secondary,
                          }}
                        >
                          {t("chat.reasoningSection")}
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails sx={{ px: 0, pt: 0 }}>
                        <Typography
                          variant="body2"
                          component="div"
                          sx={{ whiteSpace: "pre-wrap", opacity: 0.88, color: theme.palette.text.secondary }}
                        >
                          {message.reasoning}
                        </Typography>
                      </AccordionDetails>
                    </Accordion>
                  ) : null}
                  <ChatMessageMarkdown content={message.content} />
                </Box>
                
                {message.document_attachment_meta && message.document_attachment_meta.length > 0 && (
                  <Box sx={{ mt: 1, display: "flex", flexDirection: "column", gap: 0.5 }}>
                    {message.document_attachment_meta.map((d) => (
                      <Typography
                        key={d.id}
                        variant="caption"
                        sx={{ color: theme.palette.text.secondary, display: "flex", alignItems: "center", gap: 0.5 }}
                      >
                        <MsqdxIcon name="description" customSize={14} />
                        {d.filename}
                      </Typography>
                    ))}
                  </Box>
                )}
                {/* Display images if available */}
                {message.images && message.images.length > 0 && (
                  <Box sx={{ mt: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
                    {message.images.map((imageDataUrl, imageIndex) => (
                      <Box
                        key={imageIndex}
                        component="img"
                        src={imageDataUrl}
                        alt={`Attachment ${imageIndex + 1}`}
                        sx={{
                          maxWidth: "100%",
                          maxHeight: "400px",
                          borderRadius: "8px",
                          objectFit: "contain",
                          border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                          backgroundColor: alpha(theme.palette.background.paper, 0.5)
                        }}
                      />
                    ))}
                  </Box>
                )}
              </Box>
            </Stack>
          );
        })}
        <div ref={bottomRef} />
      </Stack>
    </Box>
  );
};

MsqdxGlassChatPanel.displayName = "msqdx-glass-chat-panel";

