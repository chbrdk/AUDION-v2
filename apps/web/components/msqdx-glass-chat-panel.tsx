"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  alpha,
  Box,
  Dialog,
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
import {
  systemPromptTooltipContentSx,
  systemPromptTooltipSlotSx,
} from "../lib/system-prompt-tooltip-content-sx";
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
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const lightboxHasPrev = lightboxIndex > 0;
  const lightboxHasNext = lightboxIndex < lightboxImages.length - 1;
  const lightboxLabel = useMemo(() => {
    if (lightboxImages.length === 2) return lightboxIndex === 0 ? "A" : "B";
    return `${lightboxIndex + 1}`;
  }, [lightboxImages.length, lightboxIndex]);

  const openLightbox = (images: string[], index: number) => {
    setLightboxImages(images);
    setLightboxIndex(Math.max(0, Math.min(index, images.length - 1)));
    setLightboxOpen(true);
  };

  const closeLightbox = () => setLightboxOpen(false);
  const goPrev = () => setLightboxIndex((i) => Math.max(0, i - 1));
  const goNext = () => setLightboxIndex((i) => Math.min(lightboxImages.length - 1, i + 1));

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

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxOpen, lightboxImages.length]);

  return (
    <Box sx={{ width: "100%" }}>
      <Dialog
        open={lightboxOpen}
        onClose={closeLightbox}
        fullWidth
        maxWidth="lg"
        PaperProps={{
          sx: {
            backgroundColor: alpha(theme.palette.background.default, theme.palette.mode === "dark" ? 0.72 : 0.88),
            backdropFilter: "saturate(180%) blur(18px)",
            border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
            borderRadius: 3,
            overflow: "hidden",
          },
        }}
      >
        <Box sx={{ position: "relative" }}>
          <Box
            sx={{
              position: "absolute",
              top: 10,
              left: 10,
              display: "flex",
              alignItems: "center",
              gap: 1,
              zIndex: 2,
            }}
          >
            <Box
              sx={{
                px: 1,
                py: 0.5,
                borderRadius: 999,
                border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                backgroundColor: alpha(theme.palette.background.paper, 0.5),
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: 0.6 }}>
                {`Image ${lightboxLabel}`}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ position: "absolute", top: 6, right: 6, zIndex: 2, display: "flex", gap: 0.5 }}>
            <Tooltip title="Close">
              <IconButton
                onClick={closeLightbox}
                sx={{
                  backgroundColor: alpha(theme.palette.background.paper, 0.55),
                  border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                }}
              >
                <MsqdxIcon name="close" customSize={20} />
              </IconButton>
            </Tooltip>
          </Box>

          {lightboxHasPrev ? (
            <Box sx={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", zIndex: 2 }}>
              <Tooltip title="Previous">
                <IconButton
                  onClick={goPrev}
                  sx={{
                    backgroundColor: alpha(theme.palette.background.paper, 0.55),
                    border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                  }}
                >
                  <MsqdxIcon name="chevron_left" customSize={24} />
                </IconButton>
              </Tooltip>
            </Box>
          ) : null}

          {lightboxHasNext ? (
            <Box sx={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", zIndex: 2 }}>
              <Tooltip title="Next">
                <IconButton
                  onClick={goNext}
                  sx={{
                    backgroundColor: alpha(theme.palette.background.paper, 0.55),
                    border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                  }}
                >
                  <MsqdxIcon name="chevron_right" customSize={24} />
                </IconButton>
              </Tooltip>
            </Box>
          ) : null}

          <Box
            sx={{
              width: "100%",
              height: "min(82vh, 920px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              p: { xs: 2, sm: 3 },
            }}
          >
            <Box
              component="img"
              src={lightboxImages[lightboxIndex] ?? ""}
              alt={`Image ${lightboxLabel}`}
              sx={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                borderRadius: 2,
                backgroundColor: alpha(theme.palette.background.paper, 0.25),
              }}
            />
          </Box>
        </Box>
      </Dialog>
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
                    slotProps={{
                      tooltip: { sx: systemPromptTooltipSlotSx },
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
                  {/* Display images (A/B side-by-side when 2 attachments) */}
                  {message.images && message.images.length > 0 && (
                    <Box sx={{ mt: 0.25, mb: 1.25 }}>
                      {message.images.length === 2 ? (
                        <Box
                          sx={{
                            display: "grid",
                            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                            gap: 1,
                            alignItems: "start",
                          }}
                        >
                          {message.images.map((imageDataUrl, imageIndex) => (
                            <Box
                              key={imageIndex}
                              sx={{
                                borderRadius: "12px",
                                overflow: "hidden",
                                border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                                backgroundColor: alpha(theme.palette.background.paper, 0.5),
                              }}
                            >
                              <Box
                                sx={{
                                  px: 1,
                                  py: 0.5,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                                  backgroundColor: alpha(theme.palette.background.paper, 0.35),
                                }}
                              >
                                <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
                                  {imageIndex === 0 ? "A" : "B"}
                                </Typography>
                                <Typography variant="caption" sx={{ opacity: 0.75 }}>
                                  {`Image ${imageIndex + 1}`}
                                </Typography>
                              </Box>
                              <Box
                                component="img"
                                src={imageDataUrl}
                                alt={`Attachment ${imageIndex + 1}`}
                                sx={{
                                  width: "100%",
                                  height: { xs: 220, sm: 240 },
                                  objectFit: "contain",
                                  display: "block",
                                  backgroundColor: alpha(theme.palette.background.paper, 0.35),
                                  cursor: "zoom-in",
                                }}
                                onClick={() => openLightbox(message.images ?? [], imageIndex)}
                              />
                            </Box>
                          ))}
                        </Box>
                      ) : (
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
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
                                backgroundColor: alpha(theme.palette.background.paper, 0.5),
                                cursor: "zoom-in",
                              }}
                              onClick={() => openLightbox(message.images ?? [], imageIndex)}
                            />
                          ))}
                        </Box>
                      )}
                    </Box>
                  )}

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

