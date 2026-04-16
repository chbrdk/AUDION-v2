"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { keyframes } from "@emotion/react";
import {
  alpha,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import { MsqdxGlassChatPanel } from "../../components/msqdx-glass-chat-panel";
import { MsqdxIcon, MsqdxInput } from "@msqdx/react";
import { INPUT_ACCENT_SX_WITH_FALLBACK } from "../../lib/theme-accent";
import { getChatApiBase, buildApiUrl } from "../../app/api/_lib/backend";
import { useAuth } from "../../components/auth/auth-provider";
import { useProject } from "../../components/projects/project-provider";
import { useI18n } from "../../components/i18n/i18n-provider";
import { buildAdaptiveSystemPrompt } from "../../lib/adaptive-prompt";
import { loadLearningsFromLocalStorage } from "../../lib/conversation-learnings";
import { useShareChatHeader } from "../../components/chat/share-chat-header-context";
import { sortMoodboardTiles } from "../../lib/moodboard";

/** Compatible with admin chat persona profile card (drawer details). */
type PersonaProfileCard = {
  display_name?: string | null;
  headline?: string | null;
  archetype?: string | null;
  tone?: string | null;
  age_range?: string | null;
  location?: string | null;
  tagline?: string | null;
  key_facts?: string[] | null;
  goals?: string[] | null;
  frustrations?: string[] | null;
  preferred_channels?: string[] | null;
  call_to_action?: string | null;
};

/** Compatible with admin chat persona profile (drawer details). */
type PersonaProfile = {
  name?: string | null;
  fullName?: string | null;
  headline?: string | null;
  bio?: string | null;
  age?: number | null;
  location?: string | null;
  interests?: string[];
  values?: string[];
  goals?: Array<{ label?: string; priority?: number }>;
  painPoints?: Array<{ label?: string }>;
};

type PersonaSummary = {
  id: string;
  name: string;
  segment?: string;
  headline?: string;
  image_url?: string | null;
  profile?: PersonaProfile | Record<string, unknown> | null;
  profileCard?: PersonaProfileCard | { display_name?: string } | null;
  systemPrompt?: string | null;
};

type MoodboardTile = {
  id: string;
  moodboardId: string;
  category: string;
  imageUrl: string;
  thumbUrl?: string | null;
  sourceType?: string;
  sourceUrl?: string | null;
  author?: string | null;
  license?: string | null;
  attributionText?: string | null;
  caption?: string | null;
  rationale?: string | null;
  tags?: string[];
  order: number;
  locked: boolean;
};

type Moodboard = {
  id: string;
  personaId: string;
  title: string;
  status: string;
  active: boolean;
  styleKeywords?: string[];
  tiles: MoodboardTile[];
};

type Message = {
  id: string;
  role: "user" | "persona" | "system";
  content: string;
  personaName?: string;
  reasoning?: string;
};

const welcomeFadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
`;

const welcomePulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.85; }
`;

function ChatPageLoadingFallback() {
  const { t } = useI18n();
  return (
    <Box sx={{ p: 3, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Typography>{t("common.loading")}</Typography>
    </Box>
  );
}

/** Avoid Mixed Content: use same-origin proxy when avatar URL is http/localhost on HTTPS. */
function safeAvatarSrc(avatarUrl: string | null | undefined, personaId: string | undefined): string | undefined {
  if (!avatarUrl || !personaId) return avatarUrl ?? undefined;
  if (avatarUrl.startsWith("data:")) return avatarUrl;
  if (typeof window !== "undefined" && window.location.protocol === "https:" && (avatarUrl.startsWith("http://") || avatarUrl.includes("localhost"))) {
    return buildApiUrl(`/api/persona-admin/${personaId}/avatar`);
  }
  return avatarUrl;
}

type ShareChatWelcomeMessageProps = {
  personaDisplayName: string;
  avatarUrl?: string | null;
  personaId?: string;
};

function ShareChatWelcomeMessage({ personaDisplayName, avatarUrl, personaId }: ShareChatWelcomeMessageProps) {
  const theme = useTheme();
  const safeUrl = safeAvatarSrc(avatarUrl ?? null, personaId);
  const initial = (personaDisplayName ?? "").charAt(0);
  return (
    <Box
      sx={{
        maxWidth: 480,
        width: "100%",
        textAlign: "center",
        px: 2,
        animation: `${welcomeFadeIn} 0.5s ease-out forwards`,
      }}
    >
      <Box
        sx={{
          p: 3,
          borderRadius: 4,
          border: "1px solid var(--color-secondary-dx-green)",
          backgroundColor: alpha(theme.palette.background.paper, 0.8),
          animation: `${welcomePulse} 2.5s ease-in-out 0.6s infinite`,
        }}
      >
        {/* Large persona avatar for connection – prominent in intro */}
        <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
          <Avatar
            src={safeUrl ?? undefined}
            alt={personaDisplayName}
            sx={{
              width: 160,
              height: 160,
              border: "3px solid var(--color-secondary-dx-green)",
              boxShadow: 2,
            }}
          >
            {initial ? initial.toUpperCase() : <MsqdxIcon name="person" customSize={80} />}
          </Avatar>
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
          Chat with {personaDisplayName}
        </Typography>
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
          Ask anything you’d like to know — type your message below and hit send to start the conversation.
        </Typography>
      </Box>
    </Box>
  );
}

function ChatSharePageContent() {
  const theme = useTheme();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const { user } = useAuth();
  const { activeProjectId, selectProject } = useProject();
  const { setHeaderContent } = useShareChatHeader();
  const personaIdParam = searchParams.get("personaId");
  const projectIdParam = searchParams.get("projectId");

  const [persona, setPersona] = useState<PersonaSummary | null>(null);
  const [loadingPersona, setLoadingPersona] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moodboard, setMoodboard] = useState<Moodboard | null>(null);
  const [moodboardError, setMoodboardError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [personaDrawerOpen, setPersonaDrawerOpen] = useState(false);
  const typingBuffersRef = useRef<Record<string, string>>({});
  const typingTimersRef = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});

  const profile = persona?.profile as Record<string, unknown> | undefined;
  const rawDisplayName =
    (persona?.profileCard as { display_name?: string } | undefined)?.display_name ??
    profile?.fullName ??
    profile?.full_name ??
    profile?.name ??
    persona?.name;
  const personaDisplayName = typeof rawDisplayName === "string" ? rawDisplayName : t("chat.personaFallback");

  const personaProfileCard = persona?.profileCard as PersonaProfileCard | undefined;
  const personaProfile = persona?.profile as PersonaProfile | undefined;
  const personaChipData = useMemo(
    () =>
      [
        { icon: "category", label: personaProfileCard?.archetype ?? persona?.segment },
        { icon: "graphic_eq", label: personaProfileCard?.tone },
        { icon: "schedule", label: personaProfileCard?.age_range },
        { icon: "location_on", label: personaProfileCard?.location },
      ].filter((chip) => chip.label),
    [personaProfileCard, persona]
  );
  const personaKeyFacts = useMemo(() => {
    const facts = personaProfileCard?.key_facts?.filter(Boolean) ?? [];
    if (!facts.length && persona) {
      if (persona.segment) facts.push(`Represents ${persona.segment}`);
      if (persona.headline) facts.push(persona.headline);
    }
    return facts;
  }, [personaProfileCard, persona]);
  const personaGoals = useMemo(() => {
    const cardGoals = personaProfileCard?.goals?.filter(Boolean) ?? [];
    if (cardGoals.length > 0) return cardGoals;
    const profileGoals =
      personaProfile?.goals?.map((g) => (typeof g === "string" ? g : g?.label ?? "")).filter(Boolean) ?? [];
    return profileGoals;
  }, [personaProfileCard, personaProfile]);
  const personaFrustrations = useMemo(() => {
    const cardFrustrations = personaProfileCard?.frustrations?.filter(Boolean) ?? [];
    if (cardFrustrations.length > 0) return cardFrustrations;
    const profilePainPoints =
      personaProfile?.painPoints?.map((pp) => (typeof pp === "string" ? pp : pp?.label ?? "")).filter(Boolean) ?? [];
    return profilePainPoints;
  }, [personaProfileCard, personaProfile]);
  const personaPrimaryTagline = personaProfileCard?.tagline ?? persona?.headline ?? "";
  const personaAge = personaProfile?.age;
  const personaLocation = personaProfile?.location;
  const personaInterests = personaProfile?.interests ?? [];
  const personaValues = personaProfile?.values ?? [];

  // Persona button rechts oben im Layout-Header (wie normaler Chat)
  useEffect(() => {
    if (!persona) {
      setHeaderContent(null);
      return;
    }
    setHeaderContent(
      <Button
        variant="text"
        onClick={() => setPersonaDrawerOpen(true)}
        sx={{
          textTransform: "none",
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          padding: "0.5rem 1rem",
          borderRadius: "8px",
          "&:hover": { backgroundColor: alpha(theme.palette.text.primary, 0.08) },
        }}
      >
        <Avatar
          src={safeAvatarSrc(persona?.image_url ?? null, personaIdParam ?? undefined) ?? undefined}
          alt={persona?.name ?? ""}
          sx={{ width: 36, height: 36 }}
        >
          {(persona?.name ?? "").charAt(0)}
        </Avatar>
        <Box textAlign="left">
          <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1 }}>
            {personaDisplayName}
          </Typography>
          <Typography variant="caption" sx={{ color: alpha(theme.palette.text.primary, 0.7) }}>
            View persona profile
          </Typography>
        </Box>
        <MsqdxIcon name="chevron_right" customSize={20} />
      </Button>
    );
    return () => setHeaderContent(null);
  }, [persona, personaDisplayName, setHeaderContent, theme.palette.text.primary, personaIdParam]);

  // Set project from URL
  useEffect(() => {
    if (projectIdParam && selectProject) {
      selectProject(projectIdParam);
    }
  }, [projectIdParam, selectProject]);

  // Fetch persona by ID
  useEffect(() => {
    if (!personaIdParam) {
      setLoadingPersona(false);
      setError(t("chat.noPersonaSpecified"));
      return;
    }
    let cancelled = false;
    const fetchPersona = async () => {
      setLoadingPersona(true);
      setError(null);
      try {
        // Use public share endpoint - works without login when projectId matches
        const shareUrl = projectIdParam
          ? buildApiUrl(`/api/share/persona/${personaIdParam}?projectId=${encodeURIComponent(projectIdParam)}`)
          : buildApiUrl(`/api/persona-admin/${personaIdParam}`);
        const res = await fetch(shareUrl, { cache: "no-store" });
        if (cancelled) return;
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setError(err.error || `${t("chat.loadPersonaFailed")} (${res.status})`);
          setPersona(null);
          return;
        }
        const data = await res.json();
        const systemPrompt = data.prompt?.systemPrompt ?? data.prompt?.system_prompt ?? null;
        // API returns avatar in metadata.avatarUrl (detail), not top-level image_url
        const avatarUrl = data.metadata?.avatarUrl ?? data.image_url;
        setPersona({
          id: data.id,
          name: data.name,
          segment: data.segment,
          headline: data.headline,
          image_url: avatarUrl,
          profile: data.profile,
          profileCard: data.profile_card,
          systemPrompt,
        });
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t("chat.loadPersonaFailed"));
          setPersona(null);
        }
      } finally {
        if (!cancelled) setLoadingPersona(false);
      }
    };
    fetchPersona();
    return () => {
      cancelled = true;
    };
  }, [personaIdParam, projectIdParam]);

  // Fetch moodboard (public share endpoint) when personaId/projectId is present
  useEffect(() => {
    if (!personaIdParam || !projectIdParam) {
      setMoodboard(null);
      setMoodboardError(null);
      return;
    }
    let cancelled = false;
    const fetchMoodboard = async () => {
      setMoodboardError(null);
      try {
        const url = buildApiUrl(`/api/share/persona/${personaIdParam}/moodboard?projectId=${encodeURIComponent(projectIdParam)}`);
        const res = await fetch(url, { cache: "no-store" });
        if (cancelled) return;
        if (res.status === 404) {
          setMoodboard(null);
          return;
        }
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setMoodboardError(err.error || `Moodboard (${res.status})`);
          setMoodboard(null);
          return;
        }
        const data = (await res.json()) as Moodboard;
        setMoodboard(data);
      } catch (e) {
        if (!cancelled) {
          setMoodboardError(e instanceof Error ? e.message : "Failed to load moodboard");
          setMoodboard(null);
        }
      }
    };
    fetchMoodboard();
    return () => {
      cancelled = true;
    };
  }, [personaIdParam, projectIdParam]);

  const clearTypingState = (id: string) => {
    if (typingTimersRef.current[id]) {
      clearTimeout(typingTimersRef.current[id]!);
      typingTimersRef.current[id] = null;
    }
    typingBuffersRef.current[id] = "";
  };

  const flushBuffer = (messageId: string) => {
    const buffer = typingBuffersRef.current[messageId] ?? "";
    if (!buffer.length) {
      typingTimersRef.current[messageId] = null;
      return;
    }
    const chunkSize = Math.min(3, buffer.length);
    const chunk = buffer.slice(0, chunkSize);
    typingBuffersRef.current[messageId] = buffer.slice(chunkSize);
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, content: m.content + chunk } : m))
    );
    typingTimersRef.current[messageId] = setTimeout(() => flushBuffer(messageId), 55);
  };

  const enqueueDelta = (messageId: string, delta: string) => {
    typingBuffersRef.current[messageId] = (typingBuffersRef.current[messageId] ?? "") + delta;
    if (!typingTimersRef.current[messageId]) flushBuffer(messageId);
  };

  const appendReasoningDelta = (messageId: string, delta: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, reasoning: (m.reasoning ?? "") + delta } : m))
    );
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!personaIdParam || !persona || sending || !text) return;

    setInput("");
    setSending(true);
    const userMsgId = `user-${Date.now()}`;
    const personaMsgId = `persona-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: text },
      { id: personaMsgId, role: "persona", content: "", personaName: persona.name },
    ]);

    const learnings = loadLearningsFromLocalStorage(personaIdParam).concat(
      loadLearningsFromLocalStorage("global")
    );
    const profileForPrompt = persona.profile as Record<string, unknown> | undefined;
    const normalizedPersonaProfile = {
      name: (typeof profileForPrompt?.name === "string" ? profileForPrompt.name : persona.name) ?? null,
      fullName: (typeof profileForPrompt?.fullName === "string" ? profileForPrompt.fullName : typeof profileForPrompt?.full_name === "string" ? profileForPrompt.full_name : personaDisplayName) ?? null,
      headline: (typeof profileForPrompt?.headline === "string" ? profileForPrompt.headline : persona.headline) ?? null,
      bio: null,
      age: null,
      location: null,
      gender: null,
      media_affinity: null,
      interests: [] as string[],
      colorPalette: [] as string[],
      attentionSpan: null,
      socialMediaUsage: [] as string[],
      values: [] as string[],
      traits: {} as Record<string, number>,
      painPoints: [] as Array<{ label?: string; evidenceCount?: number }>,
      goals: [] as Array<{ label?: string; priority?: number }>,
      communicationStyle: undefined,
    };

    const systemPrompt = buildAdaptiveSystemPrompt({
      persona: normalizedPersonaProfile,
      journeyPhases: undefined,
      conversationHistory: messages,
      learnings,
      currentPhase: undefined,
      messageCount: messages.filter((m) => m.role === "user").length,
      baseSystemPrompt: persona.systemPrompt ?? null,
    });

    const apiMessages: Array<{ role: string; content: string }> = [];
    if (systemPrompt) apiMessages.push({ role: "system", content: systemPrompt });
    messages
      .filter((m) => (m.role === "user" || m.role === "persona") && m.content.trim())
      .forEach((m) =>
        apiMessages.push({
          role: m.role === "persona" ? "assistant" : "user",
          content: m.content,
        })
      );
    apiMessages.push({ role: "user", content: text });

    try {
      const apiBase = getChatApiBase();
      const userId = user?.plexon_user_id ?? user?.id ?? undefined;
      const res = await fetch(`${apiBase}/message/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persona_id: personaIdParam,
          messages: apiMessages,
          ...(userId && { user_id: userId }),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamErr: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim() || !line.startsWith("data: ")) continue;
          try {
            const parsed = JSON.parse(line.slice(6)) as {
              type?: string;
              delta?: string;
              error?: string;
            };
            if (parsed.type === "delta" && parsed.delta) {
              enqueueDelta(personaMsgId, parsed.delta);
            } else if (parsed.type === "reasoning_delta" && parsed.delta) {
              appendReasoningDelta(personaMsgId, parsed.delta);
            } else if (parsed.type === "error") {
              streamErr = parsed.error ?? t("chat.unknownError");
            }
          } catch {
            /* ignore */
          }
        }
        if (streamErr) break;
      }
      if (streamErr) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === personaMsgId ? { ...m, content: streamErr!, role: "system" as const } : m
          )
        );
      }
    } catch (e) {
      clearTypingState(personaMsgId);
      const errMsg = e instanceof Error ? e.message : t("chat.sendFailed");
      setMessages((prev) =>
        prev.map((m) =>
          m.id === personaMsgId ? { ...m, content: errMsg, role: "system" as const } : m
        )
      );
    } finally {
      setSending(false);
    }
  };

  if (loadingPersona) {
    return (
      <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", p: 3 }}>
        <Stack
          spacing={2.5}
          alignItems="center"
          sx={{
            background: alpha(theme.palette.background.paper, 0.92),
            borderRadius: 4,
            border: "1px solid var(--color-neutral)",
            px: { xs: 3, md: 4 },
            py: { xs: 4, md: 5 },
            maxWidth: 480,
            width: "min(90%, 480px)",
          }}
        >
          <CircularProgress size={32} />
          <Typography variant="body2" color="text.secondary">
            Loading persona…
          </Typography>
        </Stack>
      </Box>
    );
  }

  if (error || !persona) {
    return (
      <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", p: 3 }}>
        <Stack
          spacing={2}
          alignItems="center"
          sx={{
            maxWidth: 400,
            textAlign: "center",
            background: alpha(theme.palette.background.paper, 0.92),
            borderRadius: 4,
            border: "1px solid var(--color-neutral)",
            px: 3,
            py: 4,
          }}
        >
          <MsqdxIcon name="error" customSize={48} style={{ opacity: 0.5 }} />
          <Typography variant="body1">{error ?? t("chat.personaNotFound")}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t("chat.shareLinkHint")}
          </Typography>
        </Stack>
      </Box>
    );
  }

  const sendDisabled = sending || !input.trim();

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        position: "relative",
        height: "100%",
        minHeight: 0,
      }}
    >
      {/* Status bar (Sending…) – same as admin chat */}
      {sending && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            padding: "0.5rem 1rem",
            flexShrink: 0,
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <CircularProgress size={16} />
            <Typography variant="body2" sx={{ color: alpha(theme.palette.text.primary, 0.7) }}>
              {t("chat.sending")}
            </Typography>
          </Stack>
        </Box>
      )}

      {/* Messages – same padding/structure as admin chat (Persona-Button ist im Layout-Header rechts oben) */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "1rem",
          marginBottom: "1rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: messages.length === 0 ? "center" : "flex-start",
        }}
      >
        {messages.length === 0 ? (
          <ShareChatWelcomeMessage
            personaDisplayName={personaDisplayName}
            avatarUrl={persona?.image_url}
            personaId={personaIdParam ?? undefined}
          />
        ) : (
          <Box sx={{ width: "100%", minHeight: 0, flex: 1 }}>
            {moodboard?.tiles?.length ? (
              <Box
                sx={{
                  mb: 2,
                  p: 1.5,
                  borderRadius: 2,
                  border: "1px solid var(--color-neutral)",
                  backgroundColor: alpha(theme.palette.background.paper, 0.85),
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <MsqdxIcon name="image" customSize={18} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Moodboard
                  </Typography>
                  {moodboardError ? (
                    <Typography variant="caption" sx={{ color: "error.main" }}>
                      {moodboardError}
                    </Typography>
                  ) : null}
                </Stack>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(4, 1fr)", md: "repeat(6, 1fr)" },
                    gap: 1,
                  }}
                >
                  {sortMoodboardTiles(moodboard.tiles)
                    .slice(0, 12)
                    .map((tile) => (
                      <Box
                        key={tile.id}
                        sx={{
                          borderRadius: 1.5,
                          overflow: "hidden",
                          border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                          backgroundColor: theme.palette.background.paper,
                        }}
                      >
                        <Box
                          component="img"
                          src={tile.thumbUrl || tile.imageUrl}
                          alt={tile.caption ?? tile.category}
                          sx={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", display: "block" }}
                          title={tile.attributionText ?? tile.sourceUrl ?? tile.category}
                        />
                      </Box>
                    ))}
                </Box>
              </Box>
            ) : null}
            <MsqdxGlassChatPanel messages={messages} />
          </Box>
        )}
      </Box>

      {/* Input area – same as admin chat (var(--color-neutral), rounded, maxWidth 720) */}
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        sx={{
          padding: "1rem",
          borderTop: "1px solid var(--color-neutral)",
          backgroundColor: "var(--color-neutral)",
          borderRadius: "8px",
          flexShrink: 0,
          position: "sticky",
          bottom: 0,
          zIndex: 10,
        }}
      >
        <Box
          sx={{
            display: "flex",
            gap: 1,
            alignItems: "center",
            maxWidth: "720px",
            mx: "auto",
          }}
        >
          <MsqdxInput
            fullWidth
            placeholder={t("chat.placeholder")}
            value={input}
            disabled={sending}
            onChange={(e) => setInput(e.target.value)}
            size="large"
            sx={{
              ...INPUT_ACCENT_SX_WITH_FALLBACK,
              "& .msqdx-input-wrapper": {
                ...INPUT_ACCENT_SX_WITH_FALLBACK["& .msqdx-input-wrapper"],
                borderRadius: 999,
                backgroundColor: alpha(theme.palette.text.primary, 0.08),
              },
            }}
          />
          <IconButton
            onClick={() => void handleSend()}
            disabled={sendDisabled}
            sx={{
              backgroundColor: sendDisabled
                ? alpha(theme.palette.text.primary, 0.2)
                : "var(--color-secondary-dx-green)",
              color: "#ffffff",
              borderRadius: 999,
            }}
          >
            <MsqdxIcon name="send" customSize={22} />
          </IconButton>
        </Box>
      </Box>

      {/* Persona Drawer – same as admin chat (no "Change persona" on share) */}
      <Drawer
        anchor="right"
        open={personaDrawerOpen}
        onClose={() => {
          const activeElement = document.activeElement as HTMLElement;
          if (activeElement?.closest('[role="presentation"]')) activeElement.blur();
          setPersonaDrawerOpen(false);
        }}
        PaperProps={{
          sx: {
            width: { xs: "100%", sm: 640 },
            backgroundColor: alpha(theme.palette.background.paper, theme.palette.mode === "dark" ? 0.98 : 1),
            borderLeft: "1px solid var(--color-neutral)",
            borderTopLeftRadius: 32,
            borderBottomLeftRadius: 32,
          },
        }}
      >
        <Box
          sx={{
            p: 3,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            gap: 3,
            backgroundColor: "var(--color-neutral)",
            color: theme.palette.text.primary,
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Persona overview
            </Typography>
            <IconButton size="small" onClick={() => setPersonaDrawerOpen(false)}>
              <MsqdxIcon name="close" customSize={20} />
            </IconButton>
          </Stack>
          <Stack spacing={1.5} alignItems="center">
            <Avatar
              src={safeAvatarSrc(persona?.image_url ?? null, personaIdParam ?? undefined) ?? undefined}
              alt={personaDisplayName}
              sx={{ width: 88, height: 88 }}
            >
              {(personaDisplayName ?? "").charAt(0)}
            </Avatar>
            <Box textAlign="center">
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                {personaDisplayName}
              </Typography>
              <Typography variant="body2" sx={{ color: alpha(theme.palette.text.primary, 0.7) }}>
                {personaPrimaryTagline}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="center">
              {personaChipData.map((chip) => (
                <Chip
                  key={`${chip.icon}-${chip.label}`}
                  icon={<MsqdxIcon name={chip.icon as any} customSize={16} />}
                  label={chip.label}
                  size="small"
                  sx={{ borderRadius: 999 }}
                />
              ))}
            </Stack>
          </Stack>
          <Divider />
          <Stack spacing={2.5} sx={{ flex: 1, overflowY: "auto", pr: 0.5 }}>
            <Stack spacing={1}>
              <Typography variant="subtitle2" sx={{ textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: 1 }}>
                {t("chat.demographics")}
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "repeat(auto-fit, minmax(140px, 1fr))", sm: "repeat(3, minmax(140px, 1fr))" },
                  gap: 1.5,
                }}
              >
                {[
                  { label: t("chat.fullName"), value: personaProfile?.fullName ?? personaDisplayName },
                  { label: t("chat.age"), value: personaAge != null ? `${personaAge} ${t("chat.years")}` : undefined },
                  { label: t("chat.location"), value: personaLocation },
                ].map((item) => (
                  <Box key={item.label}>
                    <Typography variant="caption" sx={{ textTransform: "uppercase", letterSpacing: 1 }}>
                      {item.label}
                    </Typography>
                    <Typography variant="body1">{item.value ?? "—"}</Typography>
                  </Box>
                ))}
              </Box>
            </Stack>
            {personaKeyFacts.length > 0 && (
              <Stack spacing={1}>
                <Typography variant="subtitle2" sx={{ textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: 1 }}>
                  {t("chat.keyFacts")}
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {personaKeyFacts.map((fact, index) => (
                    <Chip
                      key={`fact-${index}`}
                      label={fact}
                      size="small"
                      icon={<MsqdxIcon name="star" customSize={14} />}
                      sx={{ borderRadius: 999 }}
                    />
                  ))}
                </Stack>
              </Stack>
            )}
            {personaGoals.length > 0 && (
              <Stack spacing={1}>
                <Typography variant="subtitle2" sx={{ textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: 1 }}>
                  {t("chat.goals")}
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {personaGoals.map((goal, index) => (
                    <Chip
                      key={`goal-${index}`}
                      label={goal}
                      size="small"
                      icon={<MsqdxIcon name="check" customSize={14} />}
                      sx={{ borderRadius: 999 }}
                    />
                  ))}
                </Stack>
              </Stack>
            )}
            {personaFrustrations.length > 0 && (
              <Stack spacing={1}>
                <Typography variant="subtitle2" sx={{ textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: 1 }}>
                  {t("chat.frustrations")}
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {personaFrustrations.map((item, index) => (
                    <Chip
                      key={`frustration-${index}`}
                      label={item}
                      size="small"
                      icon={<MsqdxIcon name="warning" customSize={14} />}
                      sx={{ borderRadius: 999 }}
                    />
                  ))}
                </Stack>
              </Stack>
            )}
            {personaInterests.length > 0 && (
              <Stack spacing={1}>
                <Typography variant="subtitle2" sx={{ textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: 1 }}>
                  {t("chat.interests")}
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {personaInterests.map((interest, index) => (
                    <Chip
                      key={`interest-${index}`}
                      label={interest}
                      size="small"
                      icon={<MsqdxIcon name="favorite" customSize={14} />}
                      sx={{ borderRadius: 999 }}
                    />
                  ))}
                </Stack>
              </Stack>
            )}
            {personaValues.length > 0 && (
              <Stack spacing={1}>
                <Typography variant="subtitle2" sx={{ textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: 1 }}>
                  {t("chat.values")}
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {personaValues.map((value, index) => (
                    <Chip
                      key={`value-${index}`}
                      label={value}
                      size="small"
                      icon={<MsqdxIcon name="psychology" customSize={14} />}
                      sx={{ borderRadius: 999 }}
                    />
                  ))}
                </Stack>
              </Stack>
            )}
          </Stack>
        </Box>
      </Drawer>
    </Box>
  );
}

export default function ChatSharePage() {
  return (
    <Suspense
      fallback={
        <ChatPageLoadingFallback />
      }
    >
      <ChatSharePageContent />
    </Suspense>
  );
}
