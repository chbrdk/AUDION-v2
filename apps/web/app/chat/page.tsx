"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { alpha, Avatar, Box, Button, CircularProgress, IconButton, Stack, TextField, Typography, useTheme } from "@mui/material";
import { MsqdxGlassChatPanel } from "../../components/msqdx-glass-chat-panel";
import { MsqdxIcon } from "@msqdx/react";
import { getChatApiBase, buildApiUrl } from "../../app/api/_lib/backend";
import { useProject } from "../../components/projects/project-provider";
import { buildAdaptiveSystemPrompt } from "../../lib/adaptive-prompt";
import { loadLearningsFromLocalStorage } from "../../lib/conversation-learnings";

type PersonaSummary = {
  id: string;
  name: string;
  segment?: string;
  headline?: string;
  image_url?: string | null;
  profile?: { fullName?: string; headline?: string; name?: string } | null;
  profileCard?: { display_name?: string } | null;
  systemPrompt?: string | null;
};

type Message = {
  id: string;
  role: "user" | "persona" | "system";
  content: string;
  personaName?: string;
};

function ChatSharePageContent() {
  const theme = useTheme();
  const searchParams = useSearchParams();
  const { activeProjectId, selectProject } = useProject();
  const personaIdParam = searchParams.get("personaId");
  const projectIdParam = searchParams.get("projectId");

  const [persona, setPersona] = useState<PersonaSummary | null>(null);
  const [loadingPersona, setLoadingPersona] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const typingBuffersRef = useRef<Record<string, string>>({});
  const typingTimersRef = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});

  const profile = persona?.profile as Record<string, unknown> | undefined;
  const rawDisplayName =
    (persona?.profileCard as { display_name?: string } | undefined)?.display_name ??
    profile?.fullName ??
    profile?.full_name ??
    profile?.name ??
    persona?.name;
  const personaDisplayName = typeof rawDisplayName === "string" ? rawDisplayName : "Persona";

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
      setError("No persona specified");
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
          setError(err.error || `Failed to load persona (${res.status})`);
          setPersona(null);
          return;
        }
        const data = await res.json();
        const systemPrompt = data.prompt?.systemPrompt ?? data.prompt?.system_prompt ?? null;
        setPersona({
          id: data.id,
          name: data.name,
          segment: data.segment,
          headline: data.headline,
          image_url: data.image_url,
          profile: data.profile,
          profileCard: data.profile_card,
          systemPrompt,
        });
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load persona");
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
  }, [personaIdParam]);

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
      const res = await fetch(`${apiBase}/message/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona_id: personaIdParam, messages: apiMessages }),
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
            const parsed = JSON.parse(line.slice(6));
            if (parsed.type === "delta" && parsed.delta) {
              enqueueDelta(personaMsgId, parsed.delta);
            } else if (parsed.type === "error") {
              streamErr = parsed.error ?? "Unknown error";
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
      const errMsg = e instanceof Error ? e.message : "Failed to send";
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
        <Stack spacing={2} alignItems="center">
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
        <Stack spacing={2} alignItems="center" sx={{ maxWidth: 400, textAlign: "center" }}>
          <MsqdxIcon name="error" customSize={48} style={{ opacity: 0.5 }} />
          <Typography variant="body1">{error ?? "Persona not found"}</Typography>
          <Typography variant="body2" color="text.secondary">
            Check that the share link is correct and you have access to this project.
          </Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
      }}
    >
      {/* Persona header */}
      <Box
        sx={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          px: 2,
          py: 1.5,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <Avatar src={persona?.image_url ?? undefined} alt={persona?.name ?? ""} sx={{ width: 36, height: 36 }}>
          {(persona?.name ?? "").charAt(0)}
        </Avatar>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {personaDisplayName}
        </Typography>
      </Box>

      {/* Messages */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", p: 2 }}>
        <MsqdxGlassChatPanel messages={messages} />
      </Box>

      {/* Input */}
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        sx={{
          flexShrink: 0,
          p: 2,
          borderTop: "1px solid rgba(255,255,255,0.08)",
          backgroundColor: "rgba(0,0,0,0.2)",
        }}
      >
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", maxWidth: 720, mx: "auto" }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Ask the persona anything…"
            value={input}
            disabled={sending}
            onChange={(e) => setInput(e.target.value)}
            size="small"
            sx={{
              "& .MuiOutlinedInput-root": { borderRadius: 999, backgroundColor: "var(--color-neutral)" },
            }}
          />
          <IconButton
            onClick={() => void handleSend()}
            disabled={sending || !input.trim()}
            sx={{
              backgroundColor: sending || !input.trim()
                ? alpha(theme.palette.text.primary, 0.2)
                : "var(--color-secondary-dx-green)",
              color: "#fff",
              borderRadius: 999,
            }}
          >
            <MsqdxIcon name="send" customSize={22} />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
}

export default function ChatSharePage() {
  return (
    <Suspense
      fallback={
        <Box sx={{ p: 3, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Typography>Loading…</Typography>
        </Box>
      }
    >
      <ChatSharePageContent />
    </Suspense>
  );
}
