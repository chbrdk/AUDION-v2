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
  /** Optional structured UX Journey Agent payload (renders as cards). */
  uxJourney?: {
    jobId: string;
    url?: string;
    status?: "running" | "complete" | "error";
    liveUrl?: string;
    videoUrl?: string;
    /** Total steps seen for this run (even if steps[] is just a preview). */
    stepsTotal?: number;
    personaPolicy?: {
      dimensions?: Record<string, number>;
      heuristics?: string[];
    } | null;
    steps?: Array<{
      step?: number;
      action?: string;
      target?: string | null;
      reasoning?: string | null;
      screenshot?: string | null;
      /** Agent-relative path e.g. `/run/{jobId}/step/3/screenshot` — load via Next proxy. */
      screenshotUrl?: string | null;
      reasoningMeta?: {
        evaluation_previous_goal?: string | null;
        memory?: string | null;
        next_goal?: string | null;
      } | null;
      result?: string | null;
      timestamp?: string;
    }>;
    error?: string | null;
  };
};

type MsqdxGlassChatPanelProps = {
  messages: Message[];
  systemPrompt?: string; // Optional: System prompt to display in tooltip
};

/** Embedded data URL or agent-relative `screenshotUrl` (proxied via `/api/ux-journey-agent`). */
function uxJourneyStepShotSrc(
  screenshot: string | null | undefined,
  screenshotUrl: string | null | undefined,
): string | null {
  if (screenshot?.trim()) return screenshot;
  if (screenshotUrl?.trim().startsWith("/")) return `/api/ux-journey-agent${screenshotUrl}`;
  return null;
}

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

  const journeyActionMeta = (action?: string): { label: string; icon: string } => {
    const a = (action || "").toLowerCase();
    if (a === "navigate") return { label: t("chat.uxJourney.actionNavigate"), icon: "travel_explore" };
    if (a === "click") return { label: t("chat.uxJourney.actionClick"), icon: "touch_app" };
    if (a === "done") return { label: t("chat.uxJourney.actionDone"), icon: "check_circle" };
    if (a) return { label: a, icon: "bolt" };
    return { label: t("chat.uxJourney.step"), icon: "flag" };
  };

  const journeyActionChipSx = (action?: string) => {
    const a = (action || "").toLowerCase();
    const base = {
      px: 1,
      py: 0.25,
      borderRadius: 999,
      fontWeight: 800,
      letterSpacing: 0.5,
      textTransform: "uppercase" as const,
      fontSize: "0.70rem",
      lineHeight: 1.2,
      border: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
      display: "inline-flex",
      alignItems: "center",
      gap: 0.5,
    };
    if (a === "done") {
      return { ...base, backgroundColor: alpha("#16a34a", 0.16), borderColor: alpha("#16a34a", 0.35), color: "#16a34a" };
    }
    if (a === "navigate") {
      return { ...base, backgroundColor: alpha("#2563eb", 0.14), borderColor: alpha("#2563eb", 0.32), color: "#2563eb" };
    }
    if (a === "click") {
      return { ...base, backgroundColor: alpha("#0ea5e9", 0.14), borderColor: alpha("#0ea5e9", 0.32), color: "#0ea5e9" };
    }
    return { ...base, backgroundColor: alpha(theme.palette.text.primary, 0.06), color: theme.palette.text.primary };
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
                  {message.uxJourney ? (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          {t("chat.uxJourney.title")}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                          {message.uxJourney.jobId}
                        </Typography>
                        {message.uxJourney.status ? (
                          <Box
                            sx={{
                              px: 1,
                              py: 0.25,
                              borderRadius: 999,
                              border: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
                              backgroundColor: alpha(theme.palette.background.paper, 0.5),
                            }}
                          >
                            <Typography variant="caption" sx={{ fontWeight: 700 }}>
                              {message.uxJourney.status === "running"
                                ? t("chat.uxJourney.statusRunning")
                                : message.uxJourney.status === "complete"
                                  ? t("chat.uxJourney.statusComplete")
                                  : t("chat.uxJourney.statusError")}
                            </Typography>
                          </Box>
                        ) : null}
                      </Box>

                      {message.uxJourney.personaPolicy?.dimensions ? (
                        <Box
                          sx={{
                            mt: 0.25,
                            p: 1,
                            borderRadius: 2,
                            border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                            backgroundColor: alpha(theme.palette.background.paper, 0.35),
                          }}
                        >
                          <Typography variant="caption" sx={{ display: "block", mb: 0.5, color: "text.secondary" }}>
                            Persona behavior policy
                          </Typography>
                          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                            {Object.entries(message.uxJourney.personaPolicy.dimensions)
                              .slice(0, 6)
                              .map(([k, v]) => (
                                <Box
                                  key={k}
                                  sx={{
                                    px: 1,
                                    py: 0.25,
                                    borderRadius: 999,
                                    border: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
                                    backgroundColor: alpha(theme.palette.background.paper, 0.55),
                                  }}
                                >
                                  <Typography variant="caption" sx={{ fontWeight: 700 }}>
                                    {k}: {Number(v).toFixed(2)}
                                  </Typography>
                                </Box>
                              ))}
                          </Box>
                          {Array.isArray(message.uxJourney.personaPolicy.heuristics) &&
                          message.uxJourney.personaPolicy.heuristics.length ? (
                            <Typography variant="body2" sx={{ mt: 0.75, whiteSpace: "pre-wrap", color: "text.secondary" }}>
                              {message.uxJourney.personaPolicy.heuristics.slice(0, 4).map((h) => `• ${h}`).join("\n")}
                            </Typography>
                          ) : null}
                        </Box>
                      ) : null}

                      {message.uxJourney.liveUrl && message.uxJourney.status === "running" ? (
                        <Box>
                          <Typography variant="caption" sx={{ display: "block", mb: 0.5, color: "text.secondary" }}>
                            {t("chat.uxJourney.liveView")}
                          </Typography>
                          <Box
                            component="img"
                            src={message.uxJourney.liveUrl}
                            alt="Live stream"
                            sx={{
                              width: "100%",
                              maxWidth: 720,
                              borderRadius: 2,
                              border: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
                              backgroundColor: alpha(theme.palette.background.paper, 0.35),
                              display: "block",
                            }}
                          />
                        </Box>
                      ) : null}

                      {message.uxJourney.videoUrl && message.uxJourney.status === "complete" ? (
                        <Box>
                          <Typography variant="caption" sx={{ display: "block", mb: 0.5, color: "text.secondary" }}>
                            {t("chat.uxJourney.video")}
                          </Typography>
                          <Box
                            component="video"
                            controls
                            playsInline
                            src={message.uxJourney.videoUrl}
                            sx={{
                              width: "100%",
                              maxWidth: 720,
                              borderRadius: 2,
                              border: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
                              backgroundColor: "#000",
                              display: "block",
                            }}
                          />
                        </Box>
                      ) : null}

                      <Box>
                        <Typography variant="caption" sx={{ display: "block", mb: 0.5, color: "text.secondary" }}>
                          {(() => {
                            const shown = Array.isArray(message.uxJourney.steps) ? message.uxJourney.steps.length : 0;
                            const total = typeof message.uxJourney.stepsTotal === "number" ? message.uxJourney.stepsTotal : undefined;
                            if (total && total > 0) return `${t("chat.uxJourney.steps")} (${shown} ${t("chat.uxJourney.of")} ${total})`;
                            return t("chat.uxJourney.steps");
                          })()}
                        </Typography>
                        {Array.isArray(message.uxJourney.steps) && message.uxJourney.steps.length ? (
                          <Box sx={{ display: "flex", gap: 1, overflowX: "auto", pb: 0.5, scrollSnapType: "x mandatory" }}>
                            {message.uxJourney.steps.map((s, idx) => (
                              <Box
                                key={idx}
                                sx={{
                                  minWidth: 260,
                                  maxWidth: 340,
                                  flex: "0 0 auto",
                                  p: 1.5,
                                  borderRadius: 2,
                                  border: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
                                  backgroundColor: alpha(theme.palette.background.paper, 0.55),
                                  scrollSnapAlign: "start",
                                }}
                              >
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                                  {(() => {
                                    const meta = journeyActionMeta(s.action);
                                    return (
                                      <Box component="span" sx={journeyActionChipSx(s.action)}>
                                        <MsqdxIcon name={meta.icon} customSize={14} />
                                        {meta.label}
                                      </Box>
                                    );
                                  })()}
                                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                    {(() => {
                                      const n = s.step ?? idx + 1;
                                      const total = typeof message.uxJourney?.stepsTotal === "number" ? message.uxJourney.stepsTotal : undefined;
                                      if (total && total > 0) {
                                        return `${t("chat.uxJourney.step")} ${n} ${t("chat.uxJourney.of")} ${total}`;
                                      }
                                      return `${t("chat.uxJourney.step")} ${n}`;
                                    })()}
                                  </Typography>
                                </Box>

                                {(() => {
                                  const shotSrc = uxJourneyStepShotSrc(s.screenshot, s.screenshotUrl);
                                  if (!shotSrc) return null;
                                  return (
                                    <Box
                                      sx={{
                                        mt: s.target ? 0.75 : 0.9,
                                        borderRadius: 1.5,
                                        overflow: "hidden",
                                        border: `1px solid ${alpha(theme.palette.divider, 0.65)}`,
                                        backgroundColor: alpha(theme.palette.background.paper, 0.35),
                                        cursor: "zoom-in",
                                      }}
                                      onClick={() => openLightbox([shotSrc], 0)}
                                    >
                                      <Box
                                        component="img"
                                        src={shotSrc}
                                        alt={`Step ${s.step ?? idx + 1} screenshot`}
                                        sx={{
                                          width: "100%",
                                          height: 140,
                                          objectFit: "cover",
                                          display: "block",
                                        }}
                                      />
                                    </Box>
                                  );
                                })()}

                                {s.target ? (
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      mt: 0.75,
                                      fontWeight: 600,
                                      color: theme.palette.text.primary,
                                      wordBreak: "break-word",
                                    }}
                                  >
                                    {String(s.target).length > 160 ? String(s.target).slice(0, 160) + "…" : s.target}
                                  </Typography>
                                ) : null}

                                {s.reasoning ? (
                                  <Accordion
                                    disableGutters
                                    elevation={0}
                                    sx={{
                                      mt: 1,
                                      bgcolor: "transparent",
                                      "&:before": { display: "none" },
                                    }}
                                  >
                                    <AccordionSummary
                                      expandIcon={<MsqdxIcon name="expand_more" customSize={16} />}
                                      sx={{ px: 0, minHeight: 34, "& .MuiAccordionSummary-content": { my: 0 } }}
                                    >
                                      <Typography variant="caption" sx={{ letterSpacing: 0.8, textTransform: "uppercase", color: "text.secondary" }}>
                                        {t("chat.uxJourney.reasoning")}
                                      </Typography>
                                    </AccordionSummary>
                                    <AccordionDetails sx={{ px: 0, pt: 0 }}>
                                      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word", color: "text.secondary" }}>
                                        {String(s.reasoning).length > 1200 ? String(s.reasoning).slice(0, 1200) + "…" : s.reasoning}
                                      </Typography>
                                    </AccordionDetails>
                                  </Accordion>
                                ) : null}

                                {s.reasoningMeta?.evaluation_previous_goal ? (
                                  <Accordion
                                    disableGutters
                                    elevation={0}
                                    sx={{
                                      mt: s.reasoning ? 0.5 : 1,
                                      bgcolor: "transparent",
                                      "&:before": { display: "none" },
                                    }}
                                  >
                                    <AccordionSummary
                                      expandIcon={<MsqdxIcon name="expand_more" customSize={16} />}
                                      sx={{ px: 0, minHeight: 34, "& .MuiAccordionSummary-content": { my: 0 } }}
                                    >
                                      <Typography variant="caption" sx={{ letterSpacing: 0.8, textTransform: "uppercase", color: "text.secondary" }}>
                                        Previous goal evaluation
                                      </Typography>
                                    </AccordionSummary>
                                    <AccordionDetails sx={{ px: 0, pt: 0 }}>
                                      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word", color: "text.secondary" }}>
                                        {s.reasoningMeta.evaluation_previous_goal}
                                      </Typography>
                                    </AccordionDetails>
                                  </Accordion>
                                ) : null}

                                {s.reasoningMeta?.memory ? (
                                  <Accordion
                                    disableGutters
                                    elevation={0}
                                    sx={{
                                      mt: s.reasoning || s.reasoningMeta?.evaluation_previous_goal ? 0.5 : 1,
                                      bgcolor: "transparent",
                                      "&:before": { display: "none" },
                                    }}
                                  >
                                    <AccordionSummary
                                      expandIcon={<MsqdxIcon name="expand_more" customSize={16} />}
                                      sx={{ px: 0, minHeight: 34, "& .MuiAccordionSummary-content": { my: 0 } }}
                                    >
                                      <Typography variant="caption" sx={{ letterSpacing: 0.8, textTransform: "uppercase", color: "text.secondary" }}>
                                        Memory
                                      </Typography>
                                    </AccordionSummary>
                                    <AccordionDetails sx={{ px: 0, pt: 0 }}>
                                      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word", color: "text.secondary" }}>
                                        {s.reasoningMeta.memory}
                                      </Typography>
                                    </AccordionDetails>
                                  </Accordion>
                                ) : null}

                                {s.reasoningMeta?.next_goal ? (
                                  <Accordion
                                    disableGutters
                                    elevation={0}
                                    sx={{
                                      mt: s.reasoning || s.reasoningMeta?.evaluation_previous_goal || s.reasoningMeta?.memory ? 0.5 : 1,
                                      bgcolor: "transparent",
                                      "&:before": { display: "none" },
                                    }}
                                  >
                                    <AccordionSummary
                                      expandIcon={<MsqdxIcon name="expand_more" customSize={16} />}
                                      sx={{ px: 0, minHeight: 34, "& .MuiAccordionSummary-content": { my: 0 } }}
                                    >
                                      <Typography variant="caption" sx={{ letterSpacing: 0.8, textTransform: "uppercase", color: "text.secondary" }}>
                                        Next goal
                                      </Typography>
                                    </AccordionSummary>
                                    <AccordionDetails sx={{ px: 0, pt: 0 }}>
                                      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word", color: "text.secondary" }}>
                                        {s.reasoningMeta.next_goal}
                                      </Typography>
                                    </AccordionDetails>
                                  </Accordion>
                                ) : null}

                                {s.result ? (
                                  <Accordion
                                    disableGutters
                                    elevation={0}
                                    sx={{
                                      mt: s.reasoning ? 0.5 : 1,
                                      bgcolor: "transparent",
                                      "&:before": { display: "none" },
                                    }}
                                  >
                                    <AccordionSummary
                                      expandIcon={<MsqdxIcon name="expand_more" customSize={16} />}
                                      sx={{ px: 0, minHeight: 34, "& .MuiAccordionSummary-content": { my: 0 } }}
                                    >
                                      <Typography variant="caption" sx={{ letterSpacing: 0.8, textTransform: "uppercase", color: "text.secondary" }}>
                                        {t("chat.uxJourney.result")}
                                      </Typography>
                                    </AccordionSummary>
                                    <AccordionDetails sx={{ px: 0, pt: 0 }}>
                                      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word", color: "text.secondary" }}>
                                        {String(s.result).length > 1200 ? String(s.result).slice(0, 1200) + "…" : s.result}
                                      </Typography>
                                    </AccordionDetails>
                                  </Accordion>
                                ) : null}
                              </Box>
                            ))}
                          </Box>
                        ) : (
                          <Typography variant="body2" sx={{ color: "text.secondary" }}>
                            {message.uxJourney.status === "running" ? "Waiting for steps…" : "No steps."}
                          </Typography>
                        )}
                      </Box>

                      {message.uxJourney.error ? (
                        <Typography variant="body2" sx={{ color: "error.main" }}>
                          {message.uxJourney.error}
                        </Typography>
                      ) : null}
                    </Box>
                  ) : (
                    <ChatMessageMarkdown content={message.content} />
                  )}
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

