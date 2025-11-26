"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, use, useRef, useCallback } from "react";
import {
  alpha,
  Avatar,
  Box,
  Button,
  Chip,
  Collapse,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
  useTheme,
  CircularProgress,
  Tooltip
} from "@mui/material";
import { UdgGlassChatPanel } from "../../../components/udg-glass-chat-panel";
import { MaterialSymbol } from "../../../components/material-symbol";
import { getChatApiBase, getVoiceApiBase } from "../../api/_lib/backend";
import { BRAND_LOGO } from "../../../lib/branding";
import { useSpeechToText } from "../../../hooks/use-speech-to-text";
import { useWhisperTranscription } from "../../../hooks/use-whisper-transcription";
import { useAudioQueue } from "../../../hooks/use-audio-queue";
import { useThemeMode } from "../../../components/theme-registry";

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

type PersonaProfile = {
  name?: string | null;
  fullName?: string | null;
  headline?: string | null;
  bio?: string | null;
  age?: number | null;
  location?: string | null;
  gender?: string | null;
  media_affinity?: number | null;
  interests?: string[];
  colorPalette?: string[];
  attentionSpan?: string | null;
  socialMediaUsage?: string[];
  values?: string[];
  traits?: Record<string, number>;
  painPoints?: Array<{ label?: string; evidenceCount?: number }>;
  goals?: Array<{ label?: string; priority?: number }>;
  communicationStyle?: {
    vocabulary?: string[];
    sentenceStructure?: string;
    skepticismLevel?: number;
  };
};

const normalizePersonaProfile = (raw: any): PersonaProfile | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const toStringArray = (value: any): string[] => {
    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter(Boolean);
    }
    if (typeof value === "string" && value.trim()) {
      return [value.trim()];
    }
    return [];
  };

  const ageValue = raw.age;
  let age: number | null = null;
  if (typeof ageValue === "number") {
    age = ageValue;
  } else if (typeof ageValue === "string" && ageValue.trim()) {
    const parsed = parseInt(ageValue, 10);
    if (!Number.isNaN(parsed)) {
      age = parsed;
    }
  }

  const genderValue = raw.gender;
  let gender: string | null = null;
  if (typeof genderValue === "string" && genderValue.trim()) {
    gender = genderValue.trim();
  }

  const mediaAffinityValue = raw.media_affinity;
  let mediaAffinity: number | null = null;
  if (typeof mediaAffinityValue === "number") {
    mediaAffinity = mediaAffinityValue;
  } else if (typeof mediaAffinityValue === "string" && mediaAffinityValue.trim()) {
    const parsed = parseInt(mediaAffinityValue, 10);
    if (!Number.isNaN(parsed)) {
      mediaAffinity = parsed;
    }
  }

  const mapPainPoints = toStringArray(raw.pain_points).map((label) => ({
    label,
    evidenceCount: undefined
  }));
  const explicitPainPoints =
    Array.isArray(raw.pain_points) && raw.pain_points.every((item: any) => typeof item === "object")
      ? raw.pain_points.map((pp: any) => ({
          label: pp?.label ?? "",
          evidenceCount: typeof pp?.evidence_count === "number" ? pp.evidence_count : undefined
        }))
      : mapPainPoints;

  const mapGoals =
    Array.isArray(raw.goals) && raw.goals.every((item: any) => typeof item === "object")
      ? raw.goals.map((goal: any) => ({
          label: goal?.label ?? "",
          priority: typeof goal?.priority === "number" ? goal.priority : undefined
        }))
      : toStringArray(raw.goals).map((label, index) => ({
          label,
          priority: index + 1
        }));

  const communicationStyleRaw = raw.communication_style ?? {};
  const communicationStyle =
    typeof communicationStyleRaw === "object"
      ? {
          vocabulary: toStringArray(communicationStyleRaw.vocabulary ?? []),
          sentenceStructure: communicationStyleRaw.sentence_structure ?? "standard",
          skepticismLevel:
            typeof communicationStyleRaw.skepticism_level === "number"
              ? communicationStyleRaw.skepticism_level
              : 5
        }
      : undefined;

  return {
    name: raw.name ?? null,
    fullName: raw.full_name ?? raw.name ?? null,
    headline: raw.headline ?? null,
    bio: raw.bio ?? null,
    age,
    location: raw.location ?? null,
    gender,
    media_affinity: mediaAffinity,
    interests: toStringArray(raw.interests),
    colorPalette: toStringArray(raw.color_palette),
    attentionSpan: raw.attention_span ?? null,
    socialMediaUsage: toStringArray(raw.social_media_usage),
    values: toStringArray(raw.values),
    traits: raw.traits ?? {},
    painPoints: explicitPainPoints,
    goals: mapGoals,
    communicationStyle,
  };
};

type PersonaSummary = {
  id: string;
  name: string;
  segment: string;
  headline: string;
  confidence: number;
  image_url?: string | null;
  profileCard?: PersonaProfileCard | null;
  profile?: PersonaProfile | null;
};

type Message = {
  id: string;
  role: "user" | "persona" | "system";
  content: string;
  personaName?: string;
};

type ChatPageProps = {
  params: Promise<{
    conversationId: string;
  }>;
};

export default function ChatPage({ params }: ChatPageProps) {
  // Use React.use() to unwrap the params Promise
  const { conversationId } = use(params);
  const theme = useTheme();
  const { themeMode, toggleTheme } = useThemeMode();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [availablePersonas, setAvailablePersonas] = useState<PersonaSummary[]>([]);
  const [loadingPersonas, setLoadingPersonas] = useState(true);
  const [activePersonaId, setActivePersonaId] = useState<string | undefined>();
  const [thinkingLabel, setThinkingLabel] = useState<string | undefined>();
  const [latestSources, setLatestSources] = useState<Array<{
    chunk_id: string;
    document_id: string;
    title: string;
    confidence: number;
    excerpt: string;
  }>>();
  const [showEvidence, setShowEvidence] = useState(false);
  const [sending, setSending] = useState(false);
  const [personaMenuAnchor, setPersonaMenuAnchor] = useState<null | HTMLElement>(null);
  const [personaDrawerOpen, setPersonaDrawerOpen] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const typingBuffersRef = useRef<Record<string, string>>({});
  const typingTimersRef = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});
  const personaMenuOpen = Boolean(personaMenuAnchor);
  const previousInputRef = useRef("");
  const speechSessionActiveRef = useRef(false);
  const handleSendRef = useRef<((messageText?: string) => Promise<void>) | null>(null);
  const {
    supported: speechSupported,
    listening: speechListening,
    transcript: speechTranscript,
    error: speechError,
    startListening,
    stopListening,
    resetTranscript
  } = useSpeechToText();
  // Create callback for auto-sending transcribed text
  // We'll update this after handleSend is defined
  const handleTranscriptionCompleteRef = useRef<((text: string) => void) | null>(null);
  
  const {
    recording: whisperRecording,
    transcribing: whisperTranscribing,
    transcript: whisperTranscript,
    error: whisperError,
    startRecording: startWhisperRecording,
    stopRecording: stopWhisperRecording,
    resetTranscript: resetWhisperTranscript
  } = useWhisperTranscription({
    onTranscriptionComplete: (text) => {
      // Use ref callback if available
      if (handleTranscriptionCompleteRef.current) {
        handleTranscriptionCompleteRef.current(text);
      }
    }
  });
  const { enqueue: enqueueAudioChunk, stop: stopAudioQueue } = useAudioQueue();

  const activePersona = useMemo(
    () => availablePersonas.find((persona) => persona.id === activePersonaId),
    [availablePersonas, activePersonaId]
  );
  const personaProfileCard = activePersona?.profileCard ?? null;
  const personaProfile = activePersona?.profile ?? null;
  const personaDisplayName =
    personaProfileCard?.display_name ??
    personaProfile?.fullName ??
    personaProfile?.name ??
    activePersona?.name ??
    "Persona";
  const personaChipData = useMemo(
    () =>
      [
        { icon: "category", label: personaProfileCard?.archetype ?? activePersona?.segment },
        { icon: "graphic_eq", label: personaProfileCard?.tone },
        { icon: "schedule", label: personaProfileCard?.age_range },
        { icon: "location_on", label: personaProfileCard?.location }
      ].filter((chip) => chip.label),
    [personaProfileCard, activePersona]
  );
  const personaKeyFacts = useMemo(() => {
    const facts = personaProfileCard?.key_facts?.filter(Boolean) ?? [];
    if (!facts.length && activePersona) {
      facts.push(`Represents ${activePersona.segment}`);
      if (activePersona.headline) {
        facts.push(activePersona.headline);
      }
    }
    return facts;
  }, [personaProfileCard, activePersona]);
  const personaGoals = useMemo(
    () => personaProfileCard?.goals?.filter(Boolean) ?? [],
    [personaProfileCard]
  );
  const personaFrustrations = useMemo(
    () => personaProfileCard?.frustrations?.filter(Boolean) ?? [],
    [personaProfileCard]
  );
  const personaChannels = useMemo(() => {
    const channels = personaProfileCard?.preferred_channels?.filter(Boolean) ?? [];
    if (!channels.length) {
      channels.push("Email");
    }
    return channels;
  }, [personaProfileCard]);
  const personaPrimaryTagline = personaProfileCard?.tagline ?? activePersona?.headline ?? "";
  const personaCallToAction =
    personaProfileCard?.call_to_action ??
    "Bring insights with specificity, quantify the upside, and respect their time.";
  const personaAge = personaProfile?.age;
  const personaLocation = personaProfile?.location;
  const personaInterests = personaProfile?.interests ?? [];
  const personaValues = personaProfile?.values ?? [];
  const personaColorPalette = personaProfile?.colorPalette ?? [];
  const personaSocialUsage = personaProfile?.socialMediaUsage ?? [];
  const personaAttentionSpan = personaProfile?.attentionSpan;
  const personaBio = personaProfile?.bio;

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
      prev.map((message) =>
        message.id === messageId
          ? {
              ...message,
              content: message.content + chunk
            }
          : message
      )
    );
    typingTimersRef.current[messageId] = setTimeout(() => flushBuffer(messageId), 55);
  };

  const enqueueDelta = (messageId: string, delta: string) => {
    typingBuffersRef.current[messageId] = (typingBuffersRef.current[messageId] ?? "") + delta;
    if (!typingTimersRef.current[messageId]) {
      flushBuffer(messageId);
    }
  };

  // Load available personas from API on mount
  useEffect(() => {
    const loadPersonas = async () => {
      try {
        setLoadingPersonas(true);
        const response = await fetch("/api/personas");
        if (response.ok) {
          const data = await response.json();
          // API returns PersonaListResponse with {items: [...], total, page, page_size}
          const personas = Array.isArray(data) ? data : (data.items || []);
          setAvailablePersonas(
            personas.map((p: any) => ({
              id: p.id,
              name: p.name,
              segment: p.segment,
              headline: p.headline,
              confidence: p.confidence ?? 1.0,
              image_url: p.image_url,
              profileCard: p.profile_card ?? null,
              profile: normalizePersonaProfile(p.profile),
            }))
          );
        } else {
          // Try to read error message from response body
          let errorMessage = response.statusText || `HTTP ${response.status}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.detail || errorMessage;
          } catch {
            // If JSON parsing fails, try text
            try {
              const errorText = await response.text();
              if (errorText) errorMessage = errorText;
            } catch {
              // Ignore if text parsing also fails
            }
          }
          console.error("Failed to load personas:", errorMessage);
        }
      } catch (error) {
        console.error("Error loading personas:", error);
      } finally {
        setLoadingPersonas(false);
      }
    };

    loadPersonas();
  }, []);

  useEffect(() => {
    if (!speechSessionActiveRef.current) {
      return;
    }
    if (speechTranscript) {
      setInput(speechTranscript);
    } else if (!speechListening && !speechTranscript) {
      setInput(previousInputRef.current);
      previousInputRef.current = "";
      speechSessionActiveRef.current = false;
    }
  }, [speechTranscript, speechListening]);

  // Note: Whisper transcription now automatically sends via onTranscriptionComplete callback
  // This effect is kept for backwards compatibility but may not be needed
  useEffect(() => {
    if (whisperTranscript && !sending) {
      // Only set input if not already sending (to avoid duplicate sends)
      setInput(whisperTranscript);
      resetWhisperTranscript();
    }
  }, [whisperTranscript, resetWhisperTranscript, sending]);

  useEffect(() => {
    if (!voiceEnabled) {
      stopAudioQueue();
    }
  }, [voiceEnabled, stopAudioQueue]);

  // Update transcription callback ref after handleSend is defined
  useEffect(() => {
    handleTranscriptionCompleteRef.current = (text: string) => {
      // Automatically send the transcribed text
      if (text.trim() && activePersonaId && !sending) {
        // Set input and send immediately
        setInput(text);
        // Use setTimeout to ensure state is updated, then send
        setTimeout(() => {
          // Call handleSend with the transcribed text directly
          if (handleSendRef.current) {
            handleSendRef.current(text);
          }
        }, 150);
      }
    };
  }, [activePersonaId, sending]);

  const handleMicToggle = async () => {
    // Use Whisper transcription (server-side) instead of Web Speech API
    if (whisperRecording) {
      stopWhisperRecording();
      return;
    }
    
    // Start Whisper recording
    previousInputRef.current = input;
    resetWhisperTranscript();
    const started = await startWhisperRecording();
    if (!started) {
      // Fallback to Web Speech API if Whisper fails
      if (speechSupported) {
        speechSessionActiveRef.current = true;
        resetTranscript();
        await startListening();
      }
    }
  };

  const handleVoiceToggle = () => {
    setVoiceEnabled((prev) => !prev);
  };

  const sendDisabled = !activePersonaId || sending || input.trim().length === 0;

  const handleSend = async (messageText?: string) => {
    const contentToSend = (messageText?.trim() || input.trim());
    
    if (!activePersonaId || sending || !contentToSend) {
      return;
    }
    
    if (speechListening) {
      stopListening();
      speechSessionActiveRef.current = false;
    }
    stopAudioQueue();
    
    const messageContent = contentToSend;
    const messageId = `user-${Date.now()}`;
    const personaMessageId = `persona-${Date.now()}`;
    const voiceStreaming = voiceEnabled;
    
    // Add user message to UI
    setMessages((prev) => [
      ...prev,
      {
        id: messageId,
        role: "user",
        content: messageContent
      }
    ]);
    setInput("");
    setSending(true);
    setThinkingLabel(voiceStreaming ? "Sending voice message..." : "Sending message...");
    
    // Add empty persona message that we'll update as stream comes in
    setMessages((prev) => [
      ...prev,
      {
        id: personaMessageId,
        role: "persona",
        content: "",
        personaName: activePersona?.name ?? "Persona",
      }
    ]);
    clearTypingState(personaMessageId);
    
    try {
      // Use different base URLs for chat and voice endpoints
      const apiBase = voiceStreaming ? getVoiceApiBase() : getChatApiBase();
      // Note: 
      // - Chat API: /api/chat -> Nginx rewrites to /chat, router prefix is /chat, so use /message/stream
      // - Voice API: /api/voice -> Nginx rewrites to /voice, router prefix is /voice, so use /chat/stream
      const endpointPath = voiceStreaming ? "/chat/stream" : "/message/stream";
      const response = await fetch(`${apiBase}${endpointPath}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          persona_id: activePersonaId,
          message: messageContent,
        }),
      });
      
      if (!response.ok) {
        const error = await response.text().catch(() => "Unknown error");
        throw new Error(`HTTP ${response.status}: ${error}`);
      }
      
      if (!response.body) {
        throw new Error("No response body");
      }
      
      setThinkingLabel(voiceStreaming ? "Receiving voice response..." : "Receiving response...");
      
      // Read the stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let hasReceivedData = false;
      let streamStarted = false;
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            if (!hasReceivedData) {
              throw new Error("Stream ended without any data");
            }
            break;
          }
          
          hasReceivedData = true;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer
          
          for (const line of lines) {
            if (!line.trim()) continue; // Skip empty lines
            
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                
                // Set sending to false as soon as we receive the first data chunk
                if (!streamStarted) {
                  streamStarted = true;
                  setSending(false); // Allow new messages while streaming
                }
                
                if (data.type === "delta") {
                  if (data.delta) {
                    enqueueDelta(personaMessageId, data.delta);
                  }
                  if (voiceStreaming && data.audio) {
                    enqueueAudioChunk(data.audio, data.mime_type ?? "audio/mpeg");
                  }
                } else if (data.type === "sources") {
                  // Store sources for display
                  const normalizedSources = (data.sources || []).map((source: any, index: number) => ({
                    chunk_id: source.chunk_id ?? `chunk-${index}`,
                    document_id: source.document_id ?? "Unknown",
                    title: source.title ?? "Research",
                    confidence: typeof source.confidence === "number" ? source.confidence : 0.8,
                    excerpt: source.content ?? "",
                  }));
                  setLatestSources(normalizedSources);
                } else if (data.type === "complete") {
                  setThinkingLabel(undefined);
                } else if (data.type === "error") {
                  throw new Error(data.error);
                }
              } catch (e) {
                console.error("Failed to parse SSE data:", e, line);
                // Continue processing other lines
              }
            } else if (line.trim()) {
              // Log non-empty lines that don't start with "data: "
              console.error("Unexpected SSE line format:", line);
            }
          }
        }
      } catch (streamError) {
        console.error("Stream reading error:", streamError);
        throw streamError;
      } finally {
        reader.releaseLock();
        // Ensure sending is false even if stream ends early
        setSending(false);
      }
      
      setThinkingLabel(undefined);
    } catch (error) {
      console.error("Failed to send message:", error);
      stopAudioQueue();
      // Update the persona message with error
      clearTypingState(personaMessageId);
      setMessages((prev) => {
        const updated = [...prev];
        const personaMsg = updated.find((m) => m.id === personaMessageId);
        if (personaMsg) {
          personaMsg.content = `Error: ${error instanceof Error ? error.message : "Failed to send message"}`;
          personaMsg.role = "system";
        }
        return updated;
      });
      setThinkingLabel(undefined);
    } finally {
      setSending(false);
    }
  };

  // Update handleSend ref after it's defined
  useEffect(() => {
    handleSendRef.current = handleSend;
  }, [handleSend]);

  return (
    <Box
      component="main"
      sx={{
        position: "relative",
        overflow: "hidden",
        px: { xs: 1.5, md: 4 },
        py: { xs: 2, md: 4 },
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at 10% 20%, ${alpha(theme.palette.primary.main, 0.08)} 0%, transparent 35%),
                       radial-gradient(circle at 80% 0%, ${alpha(theme.palette.secondary.main, 0.08)} 0%, transparent 30%)`,
          opacity: 0.4,
          pointerEvents: "none"
        }}
      />
      <Box
        sx={{
          position: "absolute",
          top: { xs: 12, md: 24 },
          left: { xs: 16, md: 48 },
          zIndex: 3,
          display: "flex",
          alignItems: "center",
          gap: 1.75
        }}
      >
        <Image
          src={BRAND_LOGO.path}
          alt={BRAND_LOGO.alt}
          width={180}
          height={44}
          priority
          style={{
            height: "auto",
            width: "auto",
            maxWidth: "220px",
            filter: themeMode === "dark" ? "invert(1)" : "none"
          }}
        />
        <Divider
          orientation="vertical"
          flexItem
          sx={{
            height: 36,
            borderColor: "var(--color-neutral)"
          }}
        />
        <Typography
          variant="h4"
          sx={{
            fontWeight: 300,
            letterSpacing: 1.5,
            textTransform: "uppercase"
          }}
        >
          Audion
        </Typography>
      </Box>
      {!activePersonaId && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2,
            pointerEvents: "none",
          }}
        >
          <Stack
            spacing={2.5}
            alignItems="center"
            textAlign="center"
            sx={{
              pointerEvents: "auto",
              background: alpha(theme.palette.background.paper, 0.92),
              borderRadius: 4,
              border: "1px solid var(--color-neutral)",
              px: { xs: 3, md: 4 },
              py: { xs: 4, md: 5 },
              maxWidth: 480,
              width: "min(90%, 480px)"
            }}
          >
            <Typography variant="h5" sx={{ fontWeight: 500 }}>
              Choose a persona to start Audion
            </Typography>
            <Typography variant="body2">
              Pick the audience voice you’d like to talk to. We’ll tailor everything you ask to
              their perspective.
            </Typography>
            <Button
              variant="contained"
              size="large"
              startIcon={<MaterialSymbol icon="person_add" fontSize={22} />}
              onClick={(event) => setPersonaMenuAnchor(event.currentTarget)}
              disabled={loadingPersonas}
              sx={{
                borderRadius: 999,
                px: 4,
                backgroundColor: theme.palette.mode === "dark" ? "#ffffff" : "#000",
                color: theme.palette.mode === "dark" ? "#000" : "#fff",
                "&:hover": {
                  backgroundColor: theme.palette.mode === "dark" ? "#e0e0e0" : "#111"
                },
                "&.Mui-disabled": {
                  backgroundColor: alpha(theme.palette.text.primary, 0.3),
                  color: alpha(theme.palette.text.secondary, 0.8)
                }
              }}
            >
              {loadingPersonas ? "Loading personas…" : "Choose persona"}
            </Button>
            {loadingPersonas && <CircularProgress size={28} />}
          </Stack>
        </Box>
      )}
      {activePersonaId && activePersona && (
        <Box
          sx={{
            position: "absolute",
            top: { xs: 12, md: 24 },
            right: { xs: 16, md: 48 },
            zIndex: 3,
            display: "flex",
            gap: 1.5,
            alignItems: "center"
          }}
        >
          <Tooltip title={themeMode === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
            <IconButton
              onClick={toggleTheme}
              sx={{
                borderRadius: 999,
                backgroundColor: alpha(theme.palette.text.primary, 0.08),
                color: theme.palette.text.primary,
                "&:hover": {
                  backgroundColor: alpha(theme.palette.text.primary, 0.12)
                }
              }}
            >
              {themeMode === "dark" ? (
                <MaterialSymbol icon="light_mode" fontSize={22} />
              ) : (
                <MaterialSymbol icon="dark_mode" fontSize={22} />
              )}
            </IconButton>
          </Tooltip>
          <Button
            variant="text"
            onClick={() => setPersonaDrawerOpen(true)}
            sx={{
              borderRadius: 999,
              px: 1.5,
              py: 0.5,
              minHeight: "auto",
              border: "1px solid var(--color-neutral)",
              backgroundColor: alpha(theme.palette.background.paper, theme.palette.mode === "dark" ? 0.2 : 0.85),
              textTransform: "none",
              color: theme.palette.text.primary,
              display: "flex",
              alignItems: "center",
              gap: 1.5,
            }}
          >
            <Avatar
              src={activePersona.image_url ?? undefined}
              alt={activePersona.name}
              sx={{ width: 36, height: 36 }}
            >
              {activePersona.name.charAt(0)}
            </Avatar>
            <Box textAlign="left" sx={{ mr: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1 }}>
                {personaDisplayName}
              </Typography>
              <Typography variant="caption" sx={{ color: alpha(theme.palette.text.primary, 0.7) }}>
                View persona profile
              </Typography>
            </Box>
            <MaterialSymbol icon="chevron_right" fontSize={20} />
          </Button>
        </Box>
      )}
      <Box
        sx={{
          position: "relative",
          maxWidth: "1200px",
          mx: "auto",
          display: "flex",
          flexDirection: "column",
            gap: 3,
            pb: { xs: 8, md: 6 },
            flex: 1,
            minHeight: 0
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
        >
          <Box sx={{ flex: 1 }}>
            {thinkingLabel && <Typography variant="body2">{thinkingLabel}</Typography>}
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            {sending && (
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={16} />
                <Typography variant="body2">Sending…</Typography>
              </Stack>
            )}
          </Stack>
        </Stack>

        <Box sx={{ flex: 1, minHeight: 0 }}>
          <UdgGlassChatPanel messages={messages} />
        </Box>

        <Box
          component="form"
          onSubmit={(event) => {
            event.preventDefault();
            handleSend();
          }}
          sx={{
            position: "relative",
            width: "100%",
            maxWidth: "720px",
            mx: "auto",
            borderRadius: 999,
            px: { xs: 1.25, md: 2 },
            py: { xs: 1, md: 1.25 },
            display: "flex",
            gap: 1,
            alignItems: "center",
            background: alpha(theme.palette.background.paper, 0.95),
            border: "1px solid var(--color-neutral)"
          }}
        >
          <Tooltip title={
            whisperRecording 
              ? "Stop recording" 
              : whisperTranscribing 
              ? "Transcribing..." 
              : "Start voice input"
          }>
            <span>
              <IconButton
                onClick={handleMicToggle}
                disabled={sending || whisperTranscribing}
                sx={{
                  backgroundColor: (whisperRecording || whisperTranscribing) 
                    ? "var(--color-secondary-dx-pink-tint)" 
                    : alpha(theme.palette.text.primary, 0.08),
                  color: (whisperRecording || whisperTranscribing) 
                    ? "var(--color-secondary-dx-pink-on-light)" 
                    : theme.palette.text.primary,
                  "&:hover": {
                    backgroundColor: (whisperRecording || whisperTranscribing) 
                      ? "var(--color-secondary-dx-pink-tint)" 
                      : alpha(theme.palette.text.primary, 0.12),
                  },
                  "&.Mui-disabled": {
                    backgroundColor: alpha(theme.palette.text.primary, 0.05),
                    color: alpha(theme.palette.text.primary, 0.3),
                  },
                  borderRadius: 999
                }}
              >
                <MaterialSymbol icon="keyboard_voice" fontSize={22} />
              </IconButton>
            </span>
          </Tooltip>
          <TextField
            fullWidth
            variant="standard"
            placeholder="Ask the persona anything…"
            value={input}
            disabled={!activePersonaId || sending}
            onChange={(event) => setInput(event.target.value)}
            InputProps={{
              disableUnderline: true,
              sx: {
                fontSize: "1rem",
                color: theme.palette.text.primary
              }
            }}
          />
          <Tooltip title="Toggle persona playback">
            <IconButton
              onClick={handleVoiceToggle}
              sx={{
                backgroundColor: voiceEnabled ? "var(--color-secondary-dx-green)" : alpha(theme.palette.text.primary, 0.08),
                color: voiceEnabled ? "#ffffff" : theme.palette.text.primary,
                borderRadius: 999
              }}
            >
              <MaterialSymbol icon="headphones" fontSize={22} />
            </IconButton>
          </Tooltip>
          <IconButton
            onClick={() => {
              void handleSend();
            }}
            disabled={sendDisabled}
            sx={{
              backgroundColor: sendDisabled
                ? alpha(theme.palette.text.primary, 0.2)
                : "var(--color-secondary-dx-green)",
              color: "#ffffff",
              "&:hover": {
                backgroundColor: sendDisabled
                  ? alpha(theme.palette.text.primary, 0.2)
                  : "var(--color-secondary-dx-green-tint)"
              },
              transition: "background-color 150ms ease"
            }}
          >
            <MaterialSymbol icon="send" fontSize={22} />
          </IconButton>
        </Box>
        {(whisperRecording || whisperTranscribing || whisperError || speechListening || speechError) && (
          <Box sx={{ textAlign: "center", px: 2, maxWidth: "600px", mx: "auto" }}>
            <Typography
              variant="caption"
              sx={{
                color: (whisperError || speechError) 
                  ? theme.palette.error.main 
                  : alpha(theme.palette.text.primary, 0.6),
                lineHeight: 1.5,
                display: "block"
              }}
            >
              {whisperError 
                ? whisperError 
                : whisperTranscribing 
                ? "Transcribing audio…" 
                : whisperRecording 
                ? "Recording…" 
                : speechError 
                ? speechError 
                : speechListening 
                ? "Listening…" 
                : ""}
            </Typography>
            {(whisperError || speechError) && (
              <Typography
                variant="caption"
                sx={{
                  color: alpha(theme.palette.text.primary, 0.4),
                  fontSize: "0.65rem",
                  mt: 0.5,
                  display: "block",
                  fontStyle: "italic"
                }}
              >
                You can still type your messages in the input field below.
              </Typography>
            )}
          </Box>
        )}

        <Box sx={{ maxWidth: "720px", width: "100%", mx: "auto" }}>
          <Button
            variant="text"
            color="primary"
            startIcon={<MaterialSymbol icon="info" fontSize={18} />}
            endIcon={
              <MaterialSymbol
                icon="expand_more"
                fontSize={20}
                style={{
                  transform: showEvidence ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 150ms ease"
                }}
              />
            }
            disabled={!latestSources || latestSources.length === 0}
            onClick={() => setShowEvidence((prev) => !prev)}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            {showEvidence ? "Hide details" : "Show details"}
          </Button>
          <Collapse
            in={Boolean(showEvidence && latestSources && latestSources.length > 0)}
            timeout="auto"
            unmountOnExit
          >
            <Paper
              variant="outlined"
              sx={{
                borderRadius: 3,
                mt: 1,
                p: 2,
                maxHeight: 260,
                overflowY: "auto",
                backgroundColor: alpha(theme.palette.primary.main, 0.04),
                  borderColor: "var(--color-neutral)",
                transition: "background-color 200ms ease, border-color 200ms ease",
              }}
            >
              <List disablePadding>
                {latestSources?.map((source, index) => (
                  <Box key={`${source.chunk_id}-${index}`}>
                    <ListItem alignItems="flex-start" disableGutters>
                      <ListItemAvatar>
                        <MaterialSymbol
                          icon="description"
                          fontSize={22}
                          style={{ color: theme.palette.primary.main }}
                        />
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Typography variant="subtitle2" component="span">
                            {source.title} · {(source.confidence * 100).toFixed(0)}%
                          </Typography>
                        }
                        secondary={
                          <>
                            <Typography variant="body2" component="span" display="block">
                              {source.excerpt}
                            </Typography>
                            <Typography variant="caption" component="span" display="block">
                              Document {source.document_id}
                            </Typography>
                          </>
                        }
                      />
                    </ListItem>
                    {index < (latestSources?.length ?? 0) - 1 && (
                      <Divider variant="middle" sx={{ my: 1, borderColor: "var(--color-neutral)" }} />
                    )}
                  </Box>
                ))}
              </List>
            </Paper>
          </Collapse>
        </Box>
      </Box>

      <Drawer
        anchor="right"
        open={personaDrawerOpen}
        onClose={() => setPersonaDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: "100%", sm: 640 },
            backgroundColor: alpha(theme.palette.background.paper, theme.palette.mode === "dark" ? 0.98 : 1),
            borderLeft: "1px solid var(--color-neutral)",
            borderTopLeftRadius: 32,
            borderBottomLeftRadius: 32
          }
        }}
      >
        <Box
          sx={{
            p: 3,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            gap: 3,
            backgroundColor:
              themeMode === "dark"
                ? "#ffffff"
                : "var(--audion-light-html-background-color, var(--color-neutral))",
            color: themeMode === "dark" ? "#000000" : theme.palette.text.primary,
            "& .MuiTypography-root": {
              color: themeMode === "dark" ? "#000000" : theme.palette.text.primary
            },
            "& .persona-chip": {
              color: themeMode === "dark" ? "#000000" : theme.palette.text.primary,
              backgroundColor:
                themeMode === "dark"
                  ? alpha("#000000", 0.08)
                  : alpha("#ffffff", 0.8),
              "& .MuiChip-icon": {
                color: themeMode === "dark" ? "#000000" : theme.palette.text.primary
              }
            }
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Persona overview
            </Typography>
            <IconButton size="small" onClick={() => setPersonaDrawerOpen(false)}>
              <MaterialSymbol icon="close" fontSize={20} />
            </IconButton>
          </Stack>
          <Stack spacing={1.5} alignItems="center">
            <Avatar
              src={activePersona?.image_url ?? undefined}
              alt={personaDisplayName}
              sx={{ width: 88, height: 88 }}
            >
              {personaDisplayName.charAt(0)}
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
                  icon={<MaterialSymbol icon={chip.icon} fontSize={16} />}
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
                Demographics
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "repeat(auto-fit, minmax(140px, 1fr))", sm: "repeat(3, minmax(140px, 1fr))" },
                  gap: 1.5
                }}
              >
                {[
                  { label: "Full name", value: personaProfile?.fullName ?? personaDisplayName },
                  { label: "Age", value: personaAge ? `${personaAge} Jahre` : undefined },
                  { label: "Location", value: personaLocation }
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
            {personaInterests.length > 0 && (
              <Stack spacing={1}>
                <Typography variant="subtitle2" sx={{ textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: 1 }}>
                  Interests
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {personaInterests.map((interest, index) => (
                    <Chip
                      key={`interest-${index}`}
                      label={interest}
                      size="small"
                      className="persona-chip"
                      sx={{ borderRadius: 999 }}
                    />
                  ))}
                </Stack>
              </Stack>
            )}
            {personaValues.length > 0 && (
              <Stack spacing={1}>
                <Typography variant="subtitle2" sx={{ textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: 1 }}>
                  Values
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {personaValues.map((value, index) => (
                    <Chip
                      key={`value-${index}`}
                      label={value}
                      size="small"
                      className="persona-chip"
                      sx={{ borderRadius: 999 }}
                    />
                  ))}
                </Stack>
              </Stack>
            )}
            {personaColorPalette.length > 0 && (
              <Stack spacing={1}>
                <Typography variant="subtitle2" sx={{ textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: 1 }}>
                  Color palette
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {personaColorPalette.map((color, index) => (
                    <Box
                      key={`color-${index}`}
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        backgroundColor: color,
                        border: `1px solid ${themeMode === "dark" ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.1)"}`,
                        boxShadow: "0 0 4px rgba(0,0,0,0.08)"
                      }}
                      title={color}
                    />
                  ))}
                </Stack>
              </Stack>
            )}
            {(personaAttentionSpan || personaSocialUsage.length > 0) && (
              <Stack spacing={1}>
                <Typography variant="subtitle2" sx={{ textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: 1 }}>
                  Behavior
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {personaAttentionSpan && (
                    <Chip
                      label={`Attention: ${personaAttentionSpan}`}
                      size="small"
                      className="persona-chip"
                      icon={<MaterialSymbol icon="hourglass_bottom" fontSize={16} />}
                      sx={{ borderRadius: 999 }}
                    />
                  )}
                  {personaSocialUsage.map((channel, index) => (
                    <Chip
                      key={`social-${index}`}
                      label={channel}
                      size="small"
                      className="persona-chip"
                      icon={<MaterialSymbol icon="share" fontSize={16} />}
                      sx={{ borderRadius: 999 }}
                    />
                  ))}
                </Stack>
              </Stack>
            )}
            {personaBio && (
              <Stack spacing={1}>
                <Typography variant="subtitle2" sx={{ textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: 1 }}>
                  Bio
                </Typography>
                <Typography variant="body2">{personaBio}</Typography>
              </Stack>
            )}
            <Stack spacing={1}>
              <Typography variant="subtitle2" sx={{ textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: 1 }}>
                Key facts
              </Typography>
              {personaKeyFacts.length ? (
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {personaKeyFacts.map((fact, index) => (
                    <Chip
                      key={`fact-${index}`}
                      label={fact}
                      size="small"
                      icon={<MaterialSymbol icon="star" fontSize={14} />}
                      sx={{
                        borderRadius: 999,
                        maxWidth: "100%",
                        ".MuiChip-label": {
                          whiteSpace: "normal",
                          textAlign: "left",
                          fontSize: "10px",
                          color: themeMode === "dark" ? "#000000" : theme.palette.text.primary
                        }
                      }}
                      className="persona-chip"
                    />
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Insights will appear here once the persona profile is regenerated.
                </Typography>
              )}
            </Stack>
            <Stack spacing={1}>
              <Typography variant="subtitle2" sx={{ textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: 1 }}>
                Goals
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {(personaGoals.length ? personaGoals : personaKeyFacts.slice(0, 2)).map((goal, index) => (
                  <Chip
                    key={`goal-${index}`}
                    label={goal}
                    size="small"
                    icon={<MaterialSymbol icon="check" fontSize={14} />}
                    sx={{
                      borderRadius: 999,
                      ".MuiChip-label": {
                        fontSize: "10px",
                        color: themeMode === "dark" ? "#000000" : theme.palette.text.primary
                      }
                    }}
                    className="persona-chip"
                  />
                ))}
              </Stack>
            </Stack>
            <Stack spacing={1}>
              <Typography variant="subtitle2" sx={{ textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: 1 }}>
                Frustrations
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {(personaFrustrations.length ? personaFrustrations : ["Needs crisper proof points."]).map((item, index) => (
                  <Chip
                    key={`frustration-${index}`}
                    label={item}
                    size="small"
                    icon={<MaterialSymbol icon="warning" fontSize={14} />}
                    sx={{
                      borderRadius: 999,
                      ".MuiChip-label": {
                        fontSize: "10px",
                        color: themeMode === "dark" ? "#000000" : theme.palette.text.primary
                      }
                    }}
                    className="persona-chip"
                  />
                ))}
              </Stack>
            </Stack>
            <Stack spacing={1}>
              <Typography variant="subtitle2" sx={{ textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: 1 }}>
                Preferred channels
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {personaChannels.map((channel) => (
                  <Chip
                    key={channel}
                    label={channel}
                    size="small"
                    icon={<MaterialSymbol icon="chat_bubble" fontSize={16} />}
                    sx={{
                      borderRadius: 999,
                      ".MuiChip-label": {
                        fontSize: "10px",
                        color: themeMode === "dark" ? "#000000" : theme.palette.text.primary
                      }
                    }}
                    className="persona-chip"
                  />
                ))}
              </Stack>
            </Stack>
            <Stack spacing={1}>
              <Typography variant="subtitle2" sx={{ textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: 1 }}>
                Call to action
              </Typography>
              <Chip
                label={personaCallToAction}
                size="small"
                icon={<MaterialSymbol icon="campaign" fontSize={16} />}
                sx={{
                  borderRadius: 999,
                  ".MuiChip-label": {
                    whiteSpace: "normal",
                    textAlign: "left",
                    fontSize: "10px",
                    color: themeMode === "dark" ? "#000000" : theme.palette.text.primary
                  }
                }}
                className="persona-chip"
              />
            </Stack>
          </Stack>
          <Button
            variant="outlined"
            startIcon={<MaterialSymbol icon="swap_horiz" fontSize={16} />}
            onClick={(event) => setPersonaMenuAnchor(event.currentTarget)}
            sx={{
              borderRadius: 999,
              backgroundColor: themeMode === "dark" ? "#000000" : "transparent",
              borderColor: themeMode === "dark" ? "#000000" : theme.palette.text.primary,
              color: themeMode === "dark" ? "#ffffff" : theme.palette.text.primary,
              "&:hover": {
                backgroundColor:
                  themeMode === "dark"
                    ? "#111111"
                    : alpha(theme.palette.text.primary, 0.05),
                borderColor: themeMode === "dark" ? "#000000" : theme.palette.text.primary,
              }
            }}
          >
            Change persona
          </Button>
        </Box>
      </Drawer>

      <Menu
        anchorEl={personaMenuAnchor}
        open={personaMenuOpen}
        onClose={() => setPersonaMenuAnchor(null)}
        PaperProps={{
          sx: { minWidth: 260, p: 0.5 }
        }}
      >
        {loadingPersonas ? (
          <MenuItem disabled>
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={16} />
              <Typography variant="body2">Loading personas…</Typography>
            </Stack>
          </MenuItem>
        ) : availablePersonas.length === 0 ? (
          <MenuItem disabled>No personas available</MenuItem>
        ) : (
          availablePersonas.map((persona) => (
            <MenuItem
              key={persona.id}
              selected={persona.id === activePersonaId}
              onClick={() => {
                setActivePersonaId(persona.id);
                setPersonaMenuAnchor(null);
              }}
              sx={{ alignItems: "flex-start" }}
            >
              <Stack spacing={0.5}>
                <Typography variant="body1">{persona.name}</Typography>
                <Typography variant="caption">
                  {persona.segment} • {(persona.confidence * 100).toFixed(0)}% confidence
                </Typography>
              </Stack>
            </MenuItem>
          ))
        )}
      </Menu>
    </Box>
  );
}

