"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  alpha,
  Box,
  Button,
  CircularProgress,
  Dialog,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import { keyframes } from "@emotion/react";
import { MsqdxIcon } from "@msqdx/react";
import { MSQDX_TYPOGRAPHY } from "@msqdx/tokens";
import { ChatMessageMarkdown } from "./chat/chat-message-markdown";
import { glassChatPanelMessagesStackSx } from "../lib/glass-chat-panel-layout";
import { normalizeAndTruncate, normalizeReasoningText } from "../lib/normalize-reasoning-text";
import {
  systemPromptTooltipContentSx,
  systemPromptTooltipSlotSx,
} from "../lib/system-prompt-tooltip-content-sx";
import { useI18n } from "./i18n/i18n-provider";
import { withNextBasePath } from "../lib/api-routes";
import { getUxJourneyVideoPlaybackRate } from "../lib/ux-journey-playback";
import { UxJourneyLivePoll } from "./ux-journey-live-poll";

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
    /**
     * Upstream ux-journey-agent job id. Empty until the LLM's `inspect_website`
     * call has actually been approved and the agent run has started.
     */
    jobId: string;
    url?: string;
    /**
     * Card lifecycle:
     *  - "proposed": LLM asked permission, waiting for user click (confirm CTA).
     *  - "approved": user clicked Yes; waiting for the agent to start (spinner).
     *  - "running":  agent is browsing — live frame + streaming steps.
     *  - "complete": done — video + final steps.
     *  - "denied":   user clicked No; LLM continues without browsing.
     *  - "error":    upstream/agent error (shown via `error` field).
     */
    status?: "proposed" | "approved" | "running" | "complete" | "denied" | "error";
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
    /**
     * Pending human-in-the-loop confirmation. Present while `status === "proposed"`
     * (and briefly after the user clicks until the SSE state transitions).
     */
    pendingDecision?: {
      callId: string;
      promptText?: string | null;
      task?: string | null;
      maxSteps?: number | null;
      /** Local optimistic state once the user clicked but before the SSE-side transition lands. */
      submitting?: boolean;
    };
    error?: string | null;
  };
};

type MsqdxGlassChatPanelProps = {
  messages: Message[];
  systemPrompt?: string; // Optional: System prompt to display in tooltip
  /**
   * Called when the user clicks Approve/Deny on a pending `inspect_website`
   * proposal. The page is responsible for POSTing to the chat-api decision
   * endpoint and updating local state (incl. `pendingDecision.submitting`).
   * No-op safe — when omitted, the confirm CTA is hidden.
   */
  onUxJourneyDecision?: (params: {
    messageId: string;
    callId: string;
    decision: "approve" | "deny";
  }) => void;
  /**
   * Called when the user clicks the inline "Live ansehen?" hint chip on a
   * persona reply that mentions a URL but has no journey card yet. The
   * implementation typically dispatches a follow-up user message that the
   * persona will then react to (and, if approved, browse).
   */
  onInspectWebsite?: (params: { messageId: string; url: string }) => void;
};

/** Embedded data URL or agent-relative `screenshotUrl` (proxied via `/api/ux-journey-agent`). */
function uxJourneyStepShotSrc(
  screenshot: string | null | undefined,
  screenshotUrl: string | null | undefined,
): string | null {
  if (screenshot?.trim()) return screenshot;
  if (screenshotUrl?.trim().startsWith("/")) return withNextBasePath(`/api/ux-journey-agent${screenshotUrl}`);
  return null;
}

/**
 * Shared style for markdown content rendered inside per-step accordions
 * (Reasoning, Previous Goal Evaluation, Memory, Next Goal, Result).
 * Uses primary text color and a slightly smaller body size than the default
 * `body2` so the cards stay compact while remaining easy to read.
 */
const uxJourneyStepMarkdownSx = {
  color: "text.primary",
  wordBreak: "break-word",
  "& .MuiTypography-root": {
    fontSize: "0.75rem",
    lineHeight: 1.5,
  },
} as const;

/**
 * Caption-style label rendered inside each per-step accordion summary
 * (e.g. "BEGRÜNDUNG", "MEMORY"). Brand-accent color + mono font so the
 * section markers stand out without overwhelming the content.
 */
const uxJourneyStepLabelSx = {
  letterSpacing: 0.8,
  textTransform: "uppercase",
  fontFamily: MSQDX_TYPOGRAPHY.fontFamily.mono,
  fontWeight: 600,
  color: "var(--color-theme-accent)",
} as const;

/** First absolute http(s) URL in a string, or null. Used by the inline hint chip. */
const URL_RE = /\bhttps?:\/\/[^\s)]+/i;
function firstUrlInText(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = text.match(URL_RE);
  if (!m) return null;
  // Strip a few common trailing punctuation marks to avoid '...porsche.de.' etc.
  return m[0].replace(/[.,!?;:)]+$/g, "");
}

type UxJourneyStatus = NonNullable<NonNullable<Message["uxJourney"]>["status"]>;

/** Short label + tone color for the prominent status pill on the card. */
function statusPillStyle(status: UxJourneyStatus | undefined): {
  label: string;
  bg: string;
  fg: string;
  border: string;
} {
  switch (status) {
    case "proposed":
      return { label: "Bestätigung nötig", bg: alpha("#f59e0b", 0.18), fg: "#92400e", border: alpha("#f59e0b", 0.45) };
    case "approved":
      return { label: "Bereit · startet…", bg: alpha("#0ea5e9", 0.16), fg: "#0369a1", border: alpha("#0ea5e9", 0.42) };
    case "running":
      return { label: "Live · läuft", bg: alpha("#2563eb", 0.16), fg: "#1d4ed8", border: alpha("#2563eb", 0.42) };
    case "complete":
      return { label: "Abgeschlossen", bg: alpha("#16a34a", 0.16), fg: "#15803d", border: alpha("#16a34a", 0.42) };
    case "denied":
      return { label: "Abgelehnt", bg: alpha("#6b7280", 0.16), fg: "#374151", border: alpha("#6b7280", 0.42) };
    case "error":
      return { label: "Fehler", bg: alpha("#dc2626", 0.16), fg: "#991b1b", border: alpha("#dc2626", 0.42) };
    default:
      return { label: status ?? "—", bg: alpha("#6b7280", 0.12), fg: "#374151", border: alpha("#6b7280", 0.32) };
  }
}

export const MsqdxGlassChatPanel = ({
  messages,
  systemPrompt,
  onUxJourneyDecision,
  onInspectWebsite,
}: MsqdxGlassChatPanelProps) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  /**
   * Tracks whether the user is "stuck" at the bottom of the conversation.
   * Updated by a scroll listener on the nearest scrollable ancestor; we only
   * auto-scroll on message mutations (e.g. UX journey steps streaming in)
   * when the user has not manually scrolled up.
   */
  const stickToBottomRef = useRef(true);
  /** Previous message count, used to detect new bubbles (vs in-place mutation). */
  const prevMessagesLengthRef = useRef(messages.length);
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

  // Track sticky-to-bottom state by listening to the nearest scrollable ancestor.
  // If the user scrolls up, we stop auto-scrolling on subsequent message updates.
  useEffect(() => {
    const STICK_THRESHOLD_PX = 80;

    const findScrollContainer = (): HTMLElement | null => {
      let el: HTMLElement | null = bottomRef.current?.parentElement ?? null;
      while (el) {
        const cs = window.getComputedStyle(el);
        if (cs.overflowY === "auto" || cs.overflowY === "scroll") return el;
        el = el.parentElement;
      }
      return null;
    };

    const computeNearBottom = (): boolean => {
      const container = findScrollContainer();
      if (container) {
        return container.scrollHeight - container.scrollTop - container.clientHeight <= STICK_THRESHOLD_PX;
      }
      return (
        document.documentElement.scrollHeight - window.scrollY - window.innerHeight <= STICK_THRESHOLD_PX
      );
    };

    const onScroll = () => {
      stickToBottomRef.current = computeNearBottom();
    };

    onScroll();
    const container = findScrollContainer();
    const target: HTMLElement | Window = container ?? window;
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => target.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const grew = messages.length > prevMessagesLengthRef.current;
    prevMessagesLengthRef.current = messages.length;
    // Always follow when a NEW bubble is added (e.g. user just sent a message
    // or a fresh persona response begins). Otherwise only follow if the user
    // is still parked at the bottom — in-place mutations like UX-journey steps
    // streaming in must NOT yank a user who has scrolled up.
    if (grew || stickToBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      stickToBottomRef.current = true;
    }
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
                        <Box sx={{ opacity: 0.88, color: theme.palette.text.secondary }}>
                          <ChatMessageMarkdown
                            dense
                            content={normalizeReasoningText(message.reasoning)}
                          />
                        </Box>
                      </AccordionDetails>
                    </Accordion>
                  ) : null}
                  {/* Persona reply / system text — always renders, even alongside the UX-journey card. */}
                  {message.content ? <ChatMessageMarkdown content={message.content} /> : null}

                  {/* Inline "Live ansehen?" hint when persona mentions a URL but didn't trigger the tool. */}
                  {!message.uxJourney && message.role === "persona" && onInspectWebsite
                    ? (() => {
                        const url = firstUrlInText(message.content);
                        if (!url) return null;
                        return (
                          <Box sx={{ mt: 1 }}>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<MsqdxIcon name="travel_explore" customSize={16} />}
                              onClick={() => onInspectWebsite({ messageId: message.id, url })}
                              sx={{
                                borderRadius: 999,
                                textTransform: "none",
                                px: 1.25,
                                py: 0.25,
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                color: "var(--color-theme-accent)",
                                borderColor: "var(--color-theme-accent)",
                                "&:hover": {
                                  borderColor: "var(--color-theme-accent)",
                                  backgroundColor: alpha(theme.palette.text.primary, 0.04),
                                },
                              }}
                            >
                              {t("chat.uxJourney.inspectHint", { defaultValue: "Live ansehen?" })}
                              <Typography
                                component="span"
                                sx={{ ml: 0.75, color: "text.secondary", fontWeight: 500, fontSize: "0.7rem" }}
                              >
                                {url}
                              </Typography>
                            </Button>
                          </Box>
                        );
                      })()
                    : null}

                  {message.uxJourney ? (
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 1,
                        mt: message.content ? 1 : 0,
                        p: 1.25,
                        borderRadius: 2,
                        border: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
                        backgroundColor: alpha(theme.palette.background.paper, 0.35),
                      }}
                    >
                      {/* --- Header row: status pill + URL/jobId --- */}
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, alignItems: "center" }}>
                        {(() => {
                          const tone = statusPillStyle(message.uxJourney.status);
                          return (
                            <Box
                              sx={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 0.5,
                                px: 1,
                                py: 0.25,
                                borderRadius: 999,
                                border: `1px solid ${tone.border}`,
                                backgroundColor: tone.bg,
                                color: tone.fg,
                              }}
                            >
                              {message.uxJourney.status === "running" ||
                              message.uxJourney.status === "approved" ? (
                                <CircularProgress size={11} thickness={6} sx={{ color: tone.fg }} />
                              ) : (
                                <MsqdxIcon
                                  name={
                                    message.uxJourney.status === "complete"
                                      ? "check_circle"
                                      : message.uxJourney.status === "proposed"
                                        ? "help_outline"
                                        : message.uxJourney.status === "denied"
                                          ? "cancel"
                                          : message.uxJourney.status === "error"
                                            ? "error_outline"
                                            : "bolt"
                                  }
                                  customSize={14}
                                />
                              )}
                              <Typography
                                variant="caption"
                                sx={{ fontWeight: 700, letterSpacing: 0.3, color: tone.fg }}
                              >
                                {tone.label}
                              </Typography>
                            </Box>
                          );
                        })()}
                        {message.uxJourney.url ? (
                          <Tooltip title={message.uxJourney.url}>
                            <Typography
                              component="a"
                              href={message.uxJourney.url}
                              target="_blank"
                              rel="noreferrer noopener"
                              variant="caption"
                              sx={{
                                fontFamily: MSQDX_TYPOGRAPHY.fontFamily.mono,
                                color: "text.secondary",
                                textDecoration: "none",
                                maxWidth: 320,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                "&:hover": { textDecoration: "underline" },
                              }}
                            >
                              {message.uxJourney.url}
                            </Typography>
                          </Tooltip>
                        ) : null}
                        {message.uxJourney.jobId ? (
                          <Typography
                            variant="caption"
                            sx={{ ml: "auto", color: "text.secondary", fontFamily: MSQDX_TYPOGRAPHY.fontFamily.mono }}
                          >
                            #{message.uxJourney.jobId.slice(0, 8)}
                          </Typography>
                        ) : null}
                      </Box>

                      {/* --- proposed: confirm CTA --- */}
                      {message.uxJourney.status === "proposed" && message.uxJourney.pendingDecision ? (
                        <Box
                          sx={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 1,
                            p: 1.25,
                            borderRadius: 2,
                            backgroundColor: alpha("#f59e0b", 0.06),
                            border: `1px dashed ${alpha("#f59e0b", 0.45)}`,
                          }}
                        >
                          <Box sx={uxJourneyStepMarkdownSx}>
                            <ChatMessageMarkdown
                              dense
                              content={
                                message.uxJourney.pendingDecision.promptText ??
                                `Soll ich **${message.uxJourney.url ?? "diese Seite"}** live im Browser besuchen?`
                              }
                            />
                          </Box>
                          {message.uxJourney.pendingDecision.task ? (
                            <Typography
                              variant="caption"
                              sx={{ color: "text.secondary", fontStyle: "italic" }}
                            >
                              {t("chat.uxJourney.task", { defaultValue: "Auftrag" })}: {message.uxJourney.pendingDecision.task}
                            </Typography>
                          ) : null}
                          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                            <Button
                              size="small"
                              variant="contained"
                              disabled={
                                !onUxJourneyDecision || message.uxJourney.pendingDecision.submitting
                              }
                              startIcon={
                                message.uxJourney.pendingDecision.submitting ? (
                                  <CircularProgress size={14} thickness={6} sx={{ color: "inherit" }} />
                                ) : (
                                  <MsqdxIcon name="play_arrow" customSize={16} />
                                )
                              }
                              onClick={() => {
                                if (!onUxJourneyDecision || !message.uxJourney?.pendingDecision) return;
                                onUxJourneyDecision({
                                  messageId: message.id,
                                  callId: message.uxJourney.pendingDecision.callId,
                                  decision: "approve",
                                });
                              }}
                              sx={{ textTransform: "none", borderRadius: 999, px: 1.5 }}
                            >
                              {t("chat.uxJourney.confirmYes", { defaultValue: "Ja, jetzt besuchen" })}
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              disabled={
                                !onUxJourneyDecision || message.uxJourney.pendingDecision.submitting
                              }
                              startIcon={<MsqdxIcon name="block" customSize={16} />}
                              onClick={() => {
                                if (!onUxJourneyDecision || !message.uxJourney?.pendingDecision) return;
                                onUxJourneyDecision({
                                  messageId: message.id,
                                  callId: message.uxJourney.pendingDecision.callId,
                                  decision: "deny",
                                });
                              }}
                              sx={{ textTransform: "none", borderRadius: 999, px: 1.5 }}
                            >
                              {t("chat.uxJourney.confirmNo", { defaultValue: "Nein, antworte ohne" })}
                            </Button>
                          </Box>
                        </Box>
                      ) : null}

                      {/* --- approved: brief spinner while we wait for tool_started --- */}
                      {message.uxJourney.status === "approved" ? (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "text.secondary" }}>
                          <CircularProgress size={14} thickness={6} />
                          <Typography variant="caption">
                            {t("chat.uxJourney.starting", { defaultValue: "Browser-Agent startet…" })}
                          </Typography>
                        </Box>
                      ) : null}

                      {/* --- denied: short note (LLM continues with normal reply above) --- */}
                      {message.uxJourney.status === "denied" ? (
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                          {t("chat.uxJourney.deniedNote", {
                            defaultValue:
                              "Die Persona darf diese Seite nicht live besuchen. Sie antwortet stattdessen aus eigenem Wissen.",
                          })}
                        </Typography>
                      ) : null}

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

                      {message.uxJourney.status === "running" && message.uxJourney.jobId ? (
                        <Box>
                          <Typography variant="caption" sx={{ display: "block", mb: 0.5, color: "text.secondary" }}>
                            {t("chat.uxJourney.liveView")}
                          </Typography>
                          <UxJourneyLivePoll jobId={message.uxJourney.jobId} maxWidth={720} />
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
                            preload="auto"
                            src={message.uxJourney.videoUrl}
                            onLoadedMetadata={(e: React.SyntheticEvent<HTMLVideoElement>) => {
                              e.currentTarget.playbackRate = getUxJourneyVideoPlaybackRate();
                            }}
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

                      {/* --- Steps drill-down. Hidden during the proposed/approved/denied
                          phases (no steps yet / no value), and default-collapsed once the
                          run is complete so the persona summary above stays the focus. --- */}
                      {message.uxJourney.status !== "proposed" &&
                      message.uxJourney.status !== "approved" &&
                      message.uxJourney.status !== "denied" ? (
                        <Accordion
                          defaultExpanded={message.uxJourney.status === "running"}
                          disableGutters
                          elevation={0}
                          sx={{
                            bgcolor: "transparent",
                            borderTop: `1px solid ${alpha(theme.palette.divider, 0.55)}`,
                            pt: 0.5,
                            "&:before": { display: "none" },
                          }}
                        >
                          <AccordionSummary
                            expandIcon={<MsqdxIcon name="expand_more" customSize={18} />}
                            sx={{ px: 0, minHeight: 34, "& .MuiAccordionSummary-content": { my: 0 } }}
                          >
                            <Typography variant="caption" sx={{ ...uxJourneyStepLabelSx, color: "text.secondary" }}>
                              {(() => {
                                const shown = Array.isArray(message.uxJourney?.steps) ? message.uxJourney.steps.length : 0;
                                const total = typeof message.uxJourney?.stepsTotal === "number" ? message.uxJourney.stepsTotal : undefined;
                                if (total && total > 0) return `${t("chat.uxJourney.steps")} (${shown} ${t("chat.uxJourney.of")} ${total})`;
                                return t("chat.uxJourney.steps");
                              })()}
                            </Typography>
                          </AccordionSummary>
                          <AccordionDetails sx={{ px: 0, pt: 0.5 }}>
                        {Array.isArray(message.uxJourney.steps) && message.uxJourney.steps.length ? (
                          <Box sx={{ display: "flex", gap: 1, overflowX: "auto", pb: 0.5, scrollSnapType: "x mandatory" }}>
                            {message.uxJourney.steps.map((s, idx) => (
                              <Box
                                key={idx}
                                sx={{
                                  minWidth: 345,
                                  maxWidth: 450,
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
                                    {normalizeAndTruncate(s.target, 160)}
                                  </Typography>
                                ) : null}

                                {s.reasoning ? (
                                  <Accordion
                                    defaultExpanded
                                    disableGutters
                                    elevation={0}
                                    sx={{
                                      mt: 1,
                                      bgcolor: "transparent",
                                      borderTop: `1px solid ${alpha(theme.palette.divider, 0.55)}`,
                                      pt: 0.25,
                                      "&:before": { display: "none" },
                                    }}
                                  >
                                    <AccordionSummary
                                      expandIcon={<MsqdxIcon name="expand_more" customSize={16} />}
                                      sx={{ px: 0, minHeight: 34, "& .MuiAccordionSummary-content": { my: 0 } }}
                                    >
                                      <Typography variant="caption" sx={uxJourneyStepLabelSx}>
                                        {t("chat.uxJourney.reasoning")}
                                      </Typography>
                                    </AccordionSummary>
                                    <AccordionDetails sx={{ px: 0, pt: 0 }}>
                                      <Box sx={uxJourneyStepMarkdownSx}>
                                        <ChatMessageMarkdown
                                          dense
                                          content={normalizeAndTruncate(s.reasoning, 1200)}
                                        />
                                      </Box>
                                    </AccordionDetails>
                                  </Accordion>
                                ) : null}

                                {s.reasoningMeta?.evaluation_previous_goal ? (
                                  <Accordion
                                    defaultExpanded
                                    disableGutters
                                    elevation={0}
                                    sx={{
                                      mt: s.reasoning ? 0.5 : 1,
                                      bgcolor: "transparent",
                                      borderTop: `1px solid ${alpha(theme.palette.divider, 0.55)}`,
                                      pt: 0.25,
                                      "&:before": { display: "none" },
                                    }}
                                  >
                                    <AccordionSummary
                                      expandIcon={<MsqdxIcon name="expand_more" customSize={16} />}
                                      sx={{ px: 0, minHeight: 34, "& .MuiAccordionSummary-content": { my: 0 } }}
                                    >
                                      <Typography variant="caption" sx={uxJourneyStepLabelSx}>
                                        Previous goal evaluation
                                      </Typography>
                                    </AccordionSummary>
                                    <AccordionDetails sx={{ px: 0, pt: 0 }}>
                                      <Box sx={uxJourneyStepMarkdownSx}>
                                        <ChatMessageMarkdown
                                          dense
                                          content={normalizeReasoningText(s.reasoningMeta.evaluation_previous_goal)}
                                        />
                                      </Box>
                                    </AccordionDetails>
                                  </Accordion>
                                ) : null}

                                {s.reasoningMeta?.memory ? (
                                  <Accordion
                                    defaultExpanded
                                    disableGutters
                                    elevation={0}
                                    sx={{
                                      mt: s.reasoning || s.reasoningMeta?.evaluation_previous_goal ? 0.5 : 1,
                                      bgcolor: "transparent",
                                      borderTop: `1px solid ${alpha(theme.palette.divider, 0.55)}`,
                                      pt: 0.25,
                                      "&:before": { display: "none" },
                                    }}
                                  >
                                    <AccordionSummary
                                      expandIcon={<MsqdxIcon name="expand_more" customSize={16} />}
                                      sx={{ px: 0, minHeight: 34, "& .MuiAccordionSummary-content": { my: 0 } }}
                                    >
                                      <Typography variant="caption" sx={uxJourneyStepLabelSx}>
                                        Memory
                                      </Typography>
                                    </AccordionSummary>
                                    <AccordionDetails sx={{ px: 0, pt: 0 }}>
                                      <Box sx={uxJourneyStepMarkdownSx}>
                                        <ChatMessageMarkdown
                                          dense
                                          content={normalizeReasoningText(s.reasoningMeta.memory)}
                                        />
                                      </Box>
                                    </AccordionDetails>
                                  </Accordion>
                                ) : null}

                                {s.reasoningMeta?.next_goal ? (
                                  <Accordion
                                    defaultExpanded
                                    disableGutters
                                    elevation={0}
                                    sx={{
                                      mt: s.reasoning || s.reasoningMeta?.evaluation_previous_goal || s.reasoningMeta?.memory ? 0.5 : 1,
                                      bgcolor: "transparent",
                                      borderTop: `1px solid ${alpha(theme.palette.divider, 0.55)}`,
                                      pt: 0.25,
                                      "&:before": { display: "none" },
                                    }}
                                  >
                                    <AccordionSummary
                                      expandIcon={<MsqdxIcon name="expand_more" customSize={16} />}
                                      sx={{ px: 0, minHeight: 34, "& .MuiAccordionSummary-content": { my: 0 } }}
                                    >
                                      <Typography variant="caption" sx={uxJourneyStepLabelSx}>
                                        Next goal
                                      </Typography>
                                    </AccordionSummary>
                                    <AccordionDetails sx={{ px: 0, pt: 0 }}>
                                      <Box sx={uxJourneyStepMarkdownSx}>
                                        <ChatMessageMarkdown
                                          dense
                                          content={normalizeReasoningText(s.reasoningMeta.next_goal)}
                                        />
                                      </Box>
                                    </AccordionDetails>
                                  </Accordion>
                                ) : null}

                                {s.result ? (
                                  <Accordion
                                    defaultExpanded
                                    disableGutters
                                    elevation={0}
                                    sx={{
                                      mt: s.reasoning ? 0.5 : 1,
                                      bgcolor: "transparent",
                                      borderTop: `1px solid ${alpha(theme.palette.divider, 0.55)}`,
                                      pt: 0.25,
                                      "&:before": { display: "none" },
                                    }}
                                  >
                                    <AccordionSummary
                                      expandIcon={<MsqdxIcon name="expand_more" customSize={16} />}
                                      sx={{ px: 0, minHeight: 34, "& .MuiAccordionSummary-content": { my: 0 } }}
                                    >
                                      <Typography variant="caption" sx={uxJourneyStepLabelSx}>
                                        {t("chat.uxJourney.result")}
                                      </Typography>
                                    </AccordionSummary>
                                    <AccordionDetails sx={{ px: 0, pt: 0 }}>
                                      <Box sx={uxJourneyStepMarkdownSx}>
                                        <ChatMessageMarkdown
                                          dense
                                          content={normalizeAndTruncate(s.result, 1200)}
                                        />
                                      </Box>
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
                          </AccordionDetails>
                        </Accordion>
                      ) : null}

                      {message.uxJourney.error ? (
                        <Typography variant="body2" sx={{ color: "error.main" }}>
                          {message.uxJourney.error}
                        </Typography>
                      ) : null}
                    </Box>
                  ) : null}
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

