"use client";

// Disable static generation to prevent prerendering issues with useState/useContext
export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useMemo, useState, useRef, Suspense, type ReactNode } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  alpha,
  Avatar,
  Box,
  Button,
  Chip,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Drawer,
  FormControl,
  FormControlLabel,
  Checkbox,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tabs,
  Tab,
  TextField,
  Typography,
  useTheme,
  CircularProgress,
  Tooltip,
  Badge
} from "@mui/material";
import { MsqdxGlassChatPanel } from "../../../components/msqdx-glass-chat-panel";
import { ChatMessageMarkdown } from "../../../components/chat/chat-message-markdown";
import { TavusVideoPanel, type TavusSessionConfig } from "../../../components/tavus-video-panel";
import { MsqdxIcon, MsqdxInput } from "@msqdx/react";
import { INPUT_ACCENT_SX } from "../../../lib/theme-accent";
import { VariablePalette } from "../../../components/prompt-builder/VariablePalette";
import { type VariableDefinition } from "../../../components/prompt-builder/variableDefinitions";
import { getChatApiBase, getVoiceApiBase, buildApiUrl, fetchWithTimeout } from "../../api/_lib/backend";
import { useAuth } from "../../../components/auth/auth-provider";
import { useSpeechToText } from "../../../hooks/use-speech-to-text";
import { useWhisperTranscription } from "../../../hooks/use-whisper-transcription";
import { useAudioQueue } from "../../../hooks/use-audio-queue";
import { useAdminHeader } from "../../../components/admin/msqdx-glass-admin-layout";
import { journeysApi, type JourneyResponse } from "../../api/_lib/journeys";
import { buildAdaptiveSystemPrompt, type ConversationLearning } from "../../../lib/adaptive-prompt";
import { extractLearnings, mergeLearnings, saveLearningsToLocalStorage, loadLearningsFromLocalStorage } from "../../../lib/conversation-learnings";
import { getCurrentPhase } from "../../../lib/phase-detection";
import {
  saveConversationToLocalStorage,
  loadConversationFromLocalStorage,
  generateConversationTitle,
  generateConversationId,
  type Conversation
} from "../../../lib/chat-history";
import { useRouter, useSearchParams } from "next/navigation";
import { useProject } from "../../../components/projects/project-provider";
import { useI18n } from "../../../components/i18n/i18n-provider";
import { buildShareChatUrl } from "../../../lib/share-chat";
import {
  MoodboardPersonaDrawerStrip,
  type MoodboardDrawerStripModel,
} from "../../../components/moodboard-persona-drawer-strip";

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
  segment?: string;
  headline: string;
  confidence: number;
  image_url?: string | null;
  profileCard?: PersonaProfileCard | null;
  profile?: PersonaProfile | null;
  systemPrompt?: string | null; // System prompt from database
};

type Message = {
  id: string;
  role: "user" | "persona" | "system";
  content: string;
  personaName?: string;
  image_ids?: string[]; // Image IDs from upload endpoint (for backend)
  images?: string[]; // Base64 data URLs for display (thumbnails)
  reasoning?: string;
};

type TargetGroupListItem = { id: string; name: string; segment?: string };

type TargetGroupRoundResponse = {
  personaId: string;
  personaName: string;
  content: string;
  image_url?: string | null;
  sources?: Array<{ chunk_id: string; document_id: string; title: string; confidence: number; excerpt: string }>;
  reasoning?: string;
};

type TargetGroupRound = {
  userMessage: string;
  responses: TargetGroupRoundResponse[];
};

type StreamingResponseSlot = {
  personaId: string;
  personaName: string;
  content: string;
  done: boolean;
  image_url?: string | null;
  sources?: TargetGroupRoundResponse["sources"];
  error?: string;
  reasoning?: string;
};

/** Avoid Mixed Content: use same-origin proxy when avatar URL is http/localhost on HTTPS. */
function safeAvatarSrc(avatarUrl: string | null | undefined, personaId: string | undefined): string | undefined {
  if (!avatarUrl || !personaId) return avatarUrl ?? undefined;
  if (avatarUrl.startsWith("data:")) return avatarUrl;
  if (typeof window !== "undefined" && window.location.protocol === "https:" && (avatarUrl.startsWith("http://") || avatarUrl.includes("localhost"))) {
    return buildApiUrl(`/api/persona-admin/${personaId}/avatar`);
  }
  return avatarUrl;
}

const notify = (message: string) => {
  if (typeof window === "undefined") {
    return;
  }

  const existingToasts = document.querySelectorAll(".msqdx-glass-toast");
  existingToasts.forEach((toast) => toast.remove());

  const toast = document.createElement("div");
  toast.className = "msqdx-glass-toast";
  toast.textContent = message;

  Object.assign(toast.style, {
    position: "fixed",
    bottom: "30px",
    right: "30px",
    background: "#0f172a",
    color: "#ffffff",
    padding: "16px 24px",
    borderRadius: "8px",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.3)",
    zIndex: "99999",
    fontSize: "15px",
    fontWeight: "500",
    maxWidth: "450px",
    minWidth: "200px",
    animation: "slideIn 0.3s ease-out",
    pointerEvents: "auto",
    fontFamily: "system-ui, -apple-system, sans-serif",
    border: "2px solid rgba(255, 255, 255, 0.1)",
  });

  document.body.appendChild(toast);
  void toast.offsetHeight;

  setTimeout(() => {
    toast.style.animation = "slideOut 0.3s ease-out";
    setTimeout(() => {
      toast.parentNode?.removeChild(toast);
    }, 300);
  }, 5000);
};

function AdminChatPageContent() {
  const theme = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const { setHeaderContent } = useAdminHeader();
  const { activeProjectId } = useProject();
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
  }>>([]);
  const [showEvidence, setShowEvidence] = useState(false);

  // Adaptive Prompt & Learnings State
  const [learnings, setLearnings] = useState<ConversationLearning[]>([]);

  // Chat History State
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [conversationTitle, setConversationTitle] = useState<string>("");
  const [currentSystemPrompt, setCurrentSystemPrompt] = useState<string | undefined>(undefined);

  // Journey-Phasen-Dialog State
  const [journeyDialogOpen, setJourneyDialogOpen] = useState(false);
  const [journeys, setJourneys] = useState<JourneyResponse[]>([]);
  const [loadingJourneys, setLoadingJourneys] = useState(false);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(null);
  const [selectedPhases, setSelectedPhases] = useState<string[]>([]);
  const [selectedJourney, setSelectedJourney] = useState<JourneyResponse | null>(null);
  const [activeDialogTab, setActiveDialogTab] = useState<"phases" | "variables" | "attachments">("phases");
  const [attachedImages, setAttachedImages] = useState<string[]>([]); // Base64 data URLs (für Preview)
  const [pendingImageIds, setPendingImageIds] = useState<string[]>([]); // Image IDs, die mit der nächsten Nachricht gesendet werden sollen
  const [pendingImages, setPendingImages] = useState<string[]>([]); // Base64 data URLs für Anzeige (Thumbnails)
  const [sending, setSending] = useState(false);
  const [personaMenuAnchor, setPersonaMenuAnchor] = useState<null | HTMLElement>(null);
  const [personaDrawerOpen, setPersonaDrawerOpen] = useState(false);
  const [drawerMoodboard, setDrawerMoodboard] = useState<MoodboardDrawerStripModel | null>(null);
  const [drawerMoodboardError, setDrawerMoodboardError] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [tavusSessionConfig, setTavusSessionConfig] = useState<TavusSessionConfig | null>(null);
  const [tavusSessionLoading, setTavusSessionLoading] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareLinkCopied, setShareLinkCopied] = useState(false);
  // Target group chat mode: one question, all personas answer side-by-side
  const [chatMode, setChatMode] = useState<"persona" | "target_group">("persona");
  const [availableTargetGroups, setAvailableTargetGroups] = useState<TargetGroupListItem[]>([]);
  const [loadingTargetGroups, setLoadingTargetGroups] = useState(false);
  const [activeTargetGroupId, setActiveTargetGroupId] = useState<string | undefined>();
  const [targetGroupPersonas, setTargetGroupPersonas] = useState<PersonaSummary[]>([]);
  const [loadingTargetGroupPersonas, setLoadingTargetGroupPersonas] = useState(false);
  const [targetGroupRounds, setTargetGroupRounds] = useState<TargetGroupRound[]>([]);
  const [targetGroupStreamingRound, setTargetGroupStreamingRound] = useState<{
    userMessage: string;
    responses: StreamingResponseSlot[];
  } | null>(null);
  const targetGroupStreamingRoundRef = useRef<{ userMessage: string; responses: StreamingResponseSlot[] } | null>(null);
  const [sendingTargetGroup, setSendingTargetGroup] = useState(false);
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
  const handleTranscriptionCompleteRef = useRef<((text: string) => void) | null>(null);
  const replaceMessageVariablesRef = useRef<((message: string) => string) | null>(null);

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
  const personaGoals = useMemo(() => {
    // Try profileCard first, then profile
    const cardGoals = personaProfileCard?.goals?.filter(Boolean) ?? [];
    if (cardGoals.length > 0) {
      return cardGoals;
    }
    // Extract from profile if available
    const profileGoals = personaProfile?.goals?.map((g) =>
      typeof g === "string" ? g : g?.label || ""
    ).filter(Boolean) ?? [];
    return profileGoals;
  }, [personaProfileCard, personaProfile]);
  const personaFrustrations = useMemo(() => {
    // Try profileCard first, then profile (painPoints)
    const cardFrustrations = personaProfileCard?.frustrations?.filter(Boolean) ?? [];
    if (cardFrustrations.length > 0) {
      return cardFrustrations;
    }
    // Extract from profile painPoints if available
    const profilePainPoints = personaProfile?.painPoints?.map((pp) =>
      typeof pp === "string" ? pp : pp?.label || ""
    ).filter(Boolean) ?? [];
    return profilePainPoints;
  }, [personaProfileCard, personaProfile]);
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

  useEffect(() => {
    if (!activePersonaId) {
      setDrawerMoodboard(null);
      setDrawerMoodboardError(null);
      return;
    }
    let cancelled = false;
    const run = async () => {
      setDrawerMoodboardError(null);
      try {
        const res = await fetch(
          buildApiUrl(`/api/persona-admin/${encodeURIComponent(activePersonaId)}/moodboards/active`),
          { cache: "no-store", credentials: "include" }
        );
        if (cancelled) return;
        if (res.status === 404) {
          setDrawerMoodboard(null);
          return;
        }
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          setDrawerMoodboardError(err.error || `Moodboard (${res.status})`);
          setDrawerMoodboard(null);
          return;
        }
        const raw = (await res.json()) as MoodboardDrawerStripModel & { tiles?: MoodboardDrawerStripModel["tiles"] };
        setDrawerMoodboard({ ...raw, tiles: raw.tiles ?? [] });
      } catch (e) {
        if (!cancelled) {
          setDrawerMoodboardError(e instanceof Error ? e.message : "Failed to load moodboard");
          setDrawerMoodboard(null);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [activePersonaId]);

  const ensureChatPromptForPersona = useCallback((personaId: string) => {
    const url = buildApiUrl(`/api/personas/${encodeURIComponent(personaId)}/ensure-chat-prompt`);
    fetch(url, { method: "POST", credentials: "include" }).catch(() => {});
  }, []);

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

  const appendReasoningDelta = (messageId: string, delta: string) => {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === messageId ? { ...message, reasoning: (message.reasoning ?? "") + delta } : message
      )
    );
  };



  useEffect(() => {
    const loadPersonas = async () => {
      try {
        setLoadingPersonas(true);
        if (!activeProjectId) {
          setAvailablePersonas([]);
          return;
        }
        const query = new URLSearchParams({ project_id: activeProjectId });
        const response = await fetch(buildApiUrl(`/api/personas?${query.toString()}`));
        if (response.ok) {
          const data = await response.json();
          const personas = Array.isArray(data) ? data : (data.items || []);
          setAvailablePersonas(
            personas.map((p: any) => {
              // Pydantic serializes PersonaPrompt with systemPrompt (camelCase) in JSON
              const systemPrompt = p.prompt?.systemPrompt ?? p.prompt?.system_prompt ?? null;
              // API list returns avatar in avatarUrl (camelCase), not image_url
              const imageUrl = p.avatarUrl ?? p.imageUrl ?? p.image_url;
              return {
                id: p.id,
                name: p.name,
                segment: p.segment,
                headline: p.headline,
                confidence: p.confidence ?? 1.0,
                image_url: imageUrl,
                profileCard: p.profile_card ?? null,
                profile: normalizePersonaProfile(p.profile),
                systemPrompt: systemPrompt,
              };
            })
          );
        } else {
          let errorMessage = response.statusText || `HTTP ${response.status}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.detail || errorMessage;
          } catch {
            try {
              const errorText = await response.text();
              if (errorText) errorMessage = errorText;
            } catch {
              // Ignore
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
  }, [activeProjectId]);

  useEffect(() => {
    const loadTargetGroups = async () => {
      if (!activeProjectId) {
        setAvailableTargetGroups([]);
        setActiveTargetGroupId(undefined);
        return;
      }
      setLoadingTargetGroups(true);
      try {
        const res = await fetch(buildApiUrl(`/api/target-groups?project_id=${encodeURIComponent(activeProjectId)}&page_size=100`), { cache: "no-store" });
        if (!res.ok) {
          setAvailableTargetGroups([]);
          return;
        }
        const data = await res.json();
        const items = data.items ?? [];
        setAvailableTargetGroups(
          items.map((tg: { id: string; name?: string; segment?: string }) => ({
            id: tg.id,
            name: tg.name ?? tg.id,
            segment: tg.segment,
          }))
        );
      } catch {
        setAvailableTargetGroups([]);
      } finally {
        setLoadingTargetGroups(false);
      }
    };
    loadTargetGroups();
  }, [activeProjectId]);

  useEffect(() => {
    if (!activeTargetGroupId) {
      setTargetGroupPersonas([]);
      return;
    }
    let cancelled = false;
    setLoadingTargetGroupPersonas(true);
    fetchWithTimeout(buildApiUrl(`/api/target-groups/${encodeURIComponent(activeTargetGroupId)}/personas?page_size=50`), { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const errBody = await res.text().catch(() => res.statusText || "Unknown error");
          console.error("Target group personas load failed:", res.status, errBody);
          notify(t("adminChat.targetGroup.loadError") + (errBody ? ` ${errBody.slice(0, 80)}` : ""));
          return { items: [] };
        }
        return res.json();
      })
      .then((data) => {
        const items = data.items ?? [];
        const personas: PersonaSummary[] = items.map((p: any) => {
          const systemPrompt = p.prompt?.systemPrompt ?? p.prompt?.system_prompt ?? null;
          const imageUrl = p.avatarUrl ?? p.imageUrl ?? p.image_url;
          return {
            id: p.id,
            name: p.name,
            segment: p.segment,
            headline: p.headline,
            confidence: p.confidence ?? 1.0,
            image_url: imageUrl,
            profileCard: p.profile_card ?? null,
            profile: normalizePersonaProfile(p.profile),
            systemPrompt: systemPrompt,
          };
        });
        if (!cancelled) {
          setTargetGroupPersonas(personas);
          personas.slice(0, 10).forEach((p) => ensureChatPromptForPersona(p.id));
        }
      })
      .catch((err) => {
        console.error("Target group personas fetch error:", err);
        if (!cancelled) {
          setTargetGroupPersonas([]);
          notify(t("adminChat.targetGroup.loadError"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingTargetGroupPersonas(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTargetGroupId, ensureChatPromptForPersona]);

  // Ensure compact chat prompt when selection changes (backup; primary call is in selection handlers).
  useEffect(() => {
    if (!activePersonaId) return;
    const url = buildApiUrl(`/api/personas/${encodeURIComponent(activePersonaId)}/ensure-chat-prompt`);
    fetch(url, { method: "POST", credentials: "include" }).catch(() => {});
  }, [activePersonaId]);

  useEffect(() => {
    if (targetGroupPersonas.length === 0) return;
    targetGroupPersonas.slice(0, 10).forEach((p) => {
      const url = buildApiUrl(`/api/personas/${encodeURIComponent(p.id)}/ensure-chat-prompt`);
      fetch(url, { method: "POST", credentials: "include" }).catch(() => {});
    });
  }, [targetGroupPersonas]);

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

  useEffect(() => {
    if (whisperTranscript && !sending) {
      setInput(whisperTranscript);
      resetWhisperTranscript();
    }
  }, [whisperTranscript, resetWhisperTranscript, sending]);

  useEffect(() => {
    if (!voiceEnabled) {
      stopAudioQueue();
    }
  }, [voiceEnabled, stopAudioQueue]);

  useEffect(() => {
    if (videoEnabled) {
      setVideoEnabled(false);
      setTavusSessionConfig(null);
    }
  }, [activePersonaId]);

  const handleVideoToggle = async () => {
    if (videoEnabled) {
      setVideoEnabled(false);
      setTavusSessionConfig(null);
      return;
    }
    if (!activePersonaId) return;
    setTavusSessionLoading(true);
    setTavusSessionConfig(null);
    try {
      const res = await fetch(buildApiUrl("/api/chat/tavus/session"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ persona_id: activePersonaId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.detail ?? data.error ?? (res.status === 400 ? t("adminChat.tavusNoReplica") : t("adminChat.tavusSessionFailed"));
        if (typeof msg === "string") {
          notify(msg);
        } else if (msg && typeof msg === "object" && "message" in msg) {
          notify(String((msg as { message: string }).message));
        } else {
          notify(Array.isArray(msg) ? msg[0] ?? "Tavus error" : "Tavus error");
        }
        return;
      }
      setTavusSessionConfig(data);
      setVideoEnabled(true);
    } catch (e) {
      notify(t("adminChat.tavusSessionFailed"));
    } finally {
      setTavusSessionLoading(false);
    }
  };

  useEffect(() => {
    handleTranscriptionCompleteRef.current = (text: string) => {
      if (text.trim() && activePersonaId && !sending) {
        setInput(text);
        setTimeout(() => {
          if (handleSendRef.current) {
            handleSendRef.current(text);
          }
        }, 150);
      }
    };
  }, [activePersonaId, sending]);

  const handleMicToggle = async () => {
    if (whisperRecording) {
      stopWhisperRecording();
      return;
    }

    previousInputRef.current = input;
    resetWhisperTranscript();
    const started = await startWhisperRecording();
    if (!started) {
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

  const hasPersonaSelection = Boolean(activePersonaId);
  const hasTargetGroupSelection = Boolean(activeTargetGroupId);
  const showSelectionState =
    (chatMode === "persona" && !hasPersonaSelection) ||
    (chatMode === "target_group" && !hasTargetGroupSelection);
  const showChatState =
    (chatMode === "persona" && hasPersonaSelection) ||
    (chatMode === "target_group" && hasTargetGroupSelection);
  const sendDisabled =
    chatMode === "persona"
      ? !activePersonaId || sending || input.trim().length === 0
      : !activeTargetGroupId || sendingTargetGroup || targetGroupPersonas.length === 0 || input.trim().length === 0;
  // Input field: only disable when there is no valid context or a request is in flight (not when text is empty)
  const inputDisabled =
    chatMode === "persona"
      ? !activePersonaId || sending
      : !activeTargetGroupId || sendingTargetGroup || targetGroupPersonas.length === 0;

  const MAX_PERSONAS_PER_TARGET_GROUP_ROUND = 10;

  const handleSendTargetGroup = useCallback(async () => {
    const question = input.trim();
    if (!activeTargetGroupId || !question || targetGroupPersonas.length === 0 || sendingTargetGroup) return;
    const personasToAsk = targetGroupPersonas.slice(0, MAX_PERSONAS_PER_TARGET_GROUP_ROUND);
    let tgTurnSessionId = currentConversationId;
    if (!tgTurnSessionId) {
      tgTurnSessionId = generateConversationId();
      setCurrentConversationId(tgTurnSessionId);
    }
    setSendingTargetGroup(true);
    setInput("");

    const initialSlots: StreamingResponseSlot[] = personasToAsk.map((p) => ({
      personaId: p.id,
      personaName: p.name,
      content: "",
      done: false,
      image_url: p.image_url ?? null,
    }));
    const initialRound = { userMessage: question, responses: initialSlots };
    setTargetGroupStreamingRound(initialRound);
    targetGroupStreamingRoundRef.current = initialRound;

    const apiBase = getChatApiBase();
    const userId = user?.plexon_user_id ?? user?.id ?? undefined;

    const runStreamForPersona = async (persona: PersonaSummary): Promise<void> => {
      const personaId = persona.id;
      const normalizedProfile = persona.profile
        ? {
            name: persona.profile.name,
            fullName: persona.profile.fullName,
            headline: persona.profile.headline,
            bio: persona.profile.bio,
            age: persona.profile.age,
            location: persona.profile.location,
            gender: persona.profile.gender,
            media_affinity: persona.profile.media_affinity,
            interests: persona.profile.interests ?? [],
            colorPalette: persona.profile.colorPalette ?? [],
            attentionSpan: persona.profile.attentionSpan,
            socialMediaUsage: persona.profile.socialMediaUsage ?? [],
            values: persona.profile.values ?? [],
            traits: persona.profile.traits ?? {},
            painPoints: persona.profile.painPoints ?? [],
            goals: persona.profile.goals ?? [],
            communicationStyle: persona.profile.communicationStyle,
          }
        : {
            name: persona.name,
            fullName: persona.name,
            headline: persona.headline ?? null,
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
        persona: normalizedProfile,
        journeyPhases: undefined,
        conversationHistory: [],
        learnings: [],
        messageCount: 1,
        baseSystemPrompt: persona.systemPrompt ?? undefined,
      });
      const apiMessages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: question },
      ];

      try {
        const res = await fetch(`${apiBase}/message/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            persona_id: persona.id,
            messages: apiMessages,
            session_id: `${tgTurnSessionId}::tg::${persona.id}`,
            ...(userId && { user_id: userId }),
          }),
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => "Request failed");
          setTargetGroupStreamingRound((prev) => {
            if (!prev) return prev;
            const next = {
              ...prev,
              responses: prev.responses.map((r) =>
                r.personaId === personaId ? { ...r, content: `Error: ${errText}`, done: true, error: errText } : r
              ),
            };
            targetGroupStreamingRoundRef.current = next;
            return next;
          });
          return;
        }
        if (!res.body) {
          setTargetGroupStreamingRound((prev) => {
            if (!prev) return prev;
            const next = {
              ...prev,
              responses: prev.responses.map((r) =>
                r.personaId === personaId ? { ...r, content: "No response body", done: true, error: "No response body" } : r
              ),
            };
            targetGroupStreamingRoundRef.current = next;
            return next;
          });
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let streamErr: string | null = null;

        while (true) {
          const readResult = await reader.read();
          if (readResult.done) break;
          buffer += decoder.decode(readResult.value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim() || !line.startsWith("data: ")) continue;
            let parsed: {
              type?: string;
              delta?: string;
              sources?: unknown[];
              error?: string;
            } | null = null;
            try {
              parsed = JSON.parse(line.slice(6)) as {
                type?: string;
                delta?: string;
                sources?: unknown[];
                error?: string;
              };
            } catch {
              continue;
            }
            if (!parsed?.type) continue;

            if (parsed.type === "delta" && parsed.delta) {
              setTargetGroupStreamingRound((prev) => {
                if (!prev) return prev;
                const next = {
                  ...prev,
                  responses: prev.responses.map((r) =>
                    r.personaId === personaId ? { ...r, content: r.content + parsed!.delta } : r
                  ),
                };
                targetGroupStreamingRoundRef.current = next;
                return next;
              });
            } else if (parsed.type === "reasoning_delta" && parsed.delta) {
              setTargetGroupStreamingRound((prev) => {
                if (!prev) return prev;
                const next = {
                  ...prev,
                  responses: prev.responses.map((r) =>
                    r.personaId === personaId ? { ...r, reasoning: (r.reasoning ?? "") + parsed!.delta } : r
                  ),
                };
                targetGroupStreamingRoundRef.current = next;
                return next;
              });
            } else if (parsed.type === "sources" && Array.isArray(parsed.sources)) {
              const normalized = (parsed.sources as Array<{ chunk_id?: string; document_id?: string; title?: string; confidence?: number; content?: string }>).map((s, i) => ({
                chunk_id: s.chunk_id ?? `chunk-${i}`,
                document_id: s.document_id ?? "Unknown",
                title: s.title ?? "Research",
                confidence: typeof s.confidence === "number" ? s.confidence : 0.8,
                excerpt: s.content ?? "",
              }));
              setTargetGroupStreamingRound((prev) => {
                if (!prev) return prev;
                const next = {
                  ...prev,
                  responses: prev.responses.map((r) => (r.personaId === personaId ? { ...r, sources: normalized } : r)),
                };
                targetGroupStreamingRoundRef.current = next;
                return next;
              });
            } else if (parsed.type === "complete") {
              setTargetGroupStreamingRound((prev) => {
                if (!prev) return prev;
                const next = {
                  ...prev,
                  responses: prev.responses.map((r) => (r.personaId === personaId ? { ...r, done: true } : r)),
                };
                targetGroupStreamingRoundRef.current = next;
                return next;
              });
              break;
            } else if (parsed.type === "error") {
              streamErr = typeof parsed.error === "string" ? parsed.error : String(parsed.error ?? "Error");
              setTargetGroupStreamingRound((prev) => {
                if (!prev) return prev;
                const next = {
                  ...prev,
                  responses: prev.responses.map((r) =>
                    r.personaId === personaId ? { ...r, done: true, error: streamErr ?? undefined, content: r.content || (streamErr ?? "") } : r
                  ),
                };
                targetGroupStreamingRoundRef.current = next;
                return next;
              });
              break;
            }
          }
          if (streamErr) break;
        }
        reader.releaseLock();
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "Failed to get response";
        setTargetGroupStreamingRound((prev) => {
          if (!prev) return prev;
          const next = {
            ...prev,
            responses: prev.responses.map((r) =>
              r.personaId === personaId ? { ...r, content: `Error: ${errMsg}`, done: true, error: errMsg } : r
            ),
          };
          targetGroupStreamingRoundRef.current = next;
          return next;
        });
      }
    };

    const streamPromises = personasToAsk.map((p) => runStreamForPersona(p));
    await Promise.all(streamPromises);

    const roundToCommit = targetGroupStreamingRoundRef.current;
    if (roundToCommit) {
      const round: TargetGroupRound = {
        userMessage: roundToCommit.userMessage,
        responses: roundToCommit.responses.map((r) => ({
          personaId: r.personaId,
          personaName: r.personaName,
          content: r.error ? (r.content || r.error) : r.content,
          image_url: r.image_url ?? null,
          sources: r.sources ?? [],
          ...(r.reasoning?.trim() ? { reasoning: r.reasoning.trim() } : {}),
        })),
      };
      setTargetGroupRounds((r) => r.concat(round));
    }
    setTargetGroupStreamingRound(null);
    targetGroupStreamingRoundRef.current = null;
    setSendingTargetGroup(false);
    notify(t("adminChat.targetGroup.responsesReceived"));
  }, [
    activeTargetGroupId,
    input,
    targetGroupPersonas,
    sendingTargetGroup,
    user,
    t,
    currentConversationId,
  ]);

  const handleSend = useCallback(async (messageText?: string) => {
    const rawContent = (messageText?.trim() || input.trim());

    if (!activePersonaId || sending || !rawContent) {
      return;
    }

    if (speechListening) {
      stopListening();
      speechSessionActiveRef.current = false;
    }
    stopAudioQueue();

    let turnSessionId = currentConversationId;
    if (!turnSessionId) {
      turnSessionId = generateConversationId();
      setCurrentConversationId(turnSessionId);
    }

    // Ersetze Variablen in der User-Nachricht BEVOR sie gesendet wird
    const contentToSend = (replaceMessageVariablesRef.current ?? ((m: string) => m))(rawContent);

    // Extract learnings from conversation history
    const newLearnings = extractLearnings(messages, activePersonaId);
    const updatedLearnings = mergeLearnings(learnings, newLearnings);
    setLearnings(updatedLearnings);

    // Determine current phase
    const currentPhase = getCurrentPhase(messages, selectedJourney || undefined);

    // Build adaptive system prompt
    const normalizedPersonaProfile = personaProfile ? {
      name: personaProfile.name,
      fullName: personaProfile.fullName,
      headline: personaProfile.headline,
      bio: personaProfile.bio,
      age: personaProfile.age,
      location: personaProfile.location,
      gender: personaProfile.gender,
      media_affinity: personaProfile.media_affinity,
      interests: personaProfile.interests || [],
      colorPalette: personaProfile.colorPalette || [],
      attentionSpan: personaProfile.attentionSpan,
      socialMediaUsage: personaProfile.socialMediaUsage || [],
      values: personaProfile.values || [],
      traits: personaProfile.traits || {},
      painPoints: personaProfile.painPoints || [],
      goals: personaProfile.goals || [],
      communicationStyle: personaProfile.communicationStyle,
    } : {
      name: activePersona?.name || null,
      fullName: personaDisplayName || null,
      headline: personaProfileCard?.headline || activePersona?.headline || null,
      bio: null,
      age: null,
      location: personaProfileCard?.location || null,
      gender: null,
      media_affinity: null,
      interests: [],
      colorPalette: [],
      attentionSpan: null,
      socialMediaUsage: [],
      values: [],
      traits: {},
      painPoints: [],
      goals: [],
      communicationStyle: undefined,
    };

    // Debug: Log the base system prompt
    const basePrompt = activePersona?.systemPrompt ?? null;
    if (activePersona?.name?.toLowerCase().includes("clara")) {
      console.log("[Chat] Building system prompt for Clara:", {
        hasBasePrompt: !!basePrompt,
        basePromptPreview: basePrompt ? basePrompt.substring(0, 100) + "..." : null,
        hasJourneyPhases: !!selectedJourney?.phases,
        hasLearnings: updatedLearnings.length > 0,
      });
    }

    const systemPrompt = buildAdaptiveSystemPrompt({
      persona: normalizedPersonaProfile,
      journeyPhases: selectedJourney?.phases,
      conversationHistory: messages,
      learnings: updatedLearnings,
      currentPhase,
      messageCount: messages.filter((m) => m.role === "user").length,
      baseSystemPrompt: basePrompt, // Use system prompt from database
    });

    // Speichere den System-Prompt für die Historie
    setCurrentSystemPrompt(systemPrompt);

    // Collect system messages (Journey context) to include in the request
    const journeySystemMessages = messages
      .filter((msg) => msg.role === "system")
      .map((msg) => msg.content);

    // Build messages array for API
    // Type allows image_ids for user messages
    const apiMessages: Array<{ role: string; content: string; image_ids?: string[] }> = [];

    // Add adaptive system prompt as first system message
    if (systemPrompt) {
      apiMessages.push({
        role: "system",
        content: systemPrompt,
      });
    }

    // Add journey context as additional system messages
    journeySystemMessages.forEach((content) => {
      apiMessages.push({
        role: "system",
        content: content,
      });
    });

    // Add conversation history (user and assistant messages)
    // Only include messages with non-empty content (exclude placeholder messages)
    messages
      .filter((msg) => (msg.role === "user" || msg.role === "persona") && msg.content.trim().length > 0)
      .forEach((msg) => {
        apiMessages.push({
          role: msg.role === "persona" ? "assistant" : "user",
          content: msg.content,
          // Preserve image_ids from conversation history if they exist
          image_ids: msg.image_ids,
        });
      });

    // Add current user message with image_ids if available
    const userMessage: { role: string; content: string; image_ids?: string[] } = {
      role: "user",
      content: contentToSend,
    };

    // Füge Image-IDs hinzu, wenn vorhanden
    if (pendingImageIds.length > 0) {
      userMessage.image_ids = [...pendingImageIds];
    }

    apiMessages.push(userMessage);

    const messageId = `user-${Date.now()}`;
    const personaMessageId = `persona-${Date.now()}`;
    const voiceStreaming = voiceEnabled;

    setMessages((prev) => [
      ...prev,
      {
        id: messageId,
        role: "user",
        content: contentToSend,
        image_ids: pendingImageIds.length > 0 ? [...pendingImageIds] : undefined,
        images: pendingImages.length > 0 ? [...pendingImages] : undefined // Base64 für Thumbnails
      }
    ]);
    setInput("");
    setPendingImageIds([]); // Reset pending image IDs after sending
    setPendingImages([]); // Reset pending images after sending
    setSending(true);
    setThinkingLabel(voiceStreaming ? "Sending voice message..." : "Sending message...");

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
      const apiBase = voiceStreaming ? getVoiceApiBase() : getChatApiBase();
      const endpointPath = voiceStreaming ? "/chat/stream" : "/message/stream";
      const userId = user?.plexon_user_id ?? user?.id ?? undefined;
      const requestBody = {
        persona_id: activePersonaId,
        messages: apiMessages,
        session_id: turnSessionId,
        ...(userId && { user_id: userId }),
      };

      const response = await fetch(`${apiBase}${endpointPath}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.text().catch(() => "Unknown error");
        throw new Error(`HTTP ${response.status}: ${error}`);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      setThinkingLabel(voiceStreaming ? "Receiving voice response..." : "Receiving response...");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let hasReceivedData = false;
      let streamStarted = false;
      let streamErr: string | null = null;

      // Process stream inline - no external functions to avoid closure issues
      while (true) {
        const readResult = await reader.read();
        if (readResult.done) {
          if (!hasReceivedData) {
            streamErr = "Stream ended without any data";
          }
          break;
        }

        hasReceivedData = true;
        buffer += decoder.decode(readResult.value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          if (!line.startsWith("data: ")) continue;

          let parsedData: any = null;
          const jsonStr = line.slice(6);
          try {
            parsedData = JSON.parse(jsonStr);
          } catch {
            continue;
          }

          if (!parsedData) continue;

          if (!streamStarted) {
            streamStarted = true;
            setSending(false);
          }

          if (parsedData.type === "delta") {
            if (parsedData.delta) {
              enqueueDelta(personaMessageId, parsedData.delta);
            }
            if (voiceStreaming && parsedData.audio) {
              enqueueAudioChunk(parsedData.audio, parsedData.mime_type ?? "audio/mpeg");
            }
          } else if (parsedData.type === "reasoning_delta" && parsedData.delta) {
            appendReasoningDelta(personaMessageId, parsedData.delta);
          } else if (parsedData.type === "sources") {
            const normalizedSources = (parsedData.sources || []).map((source: any, index: number) => ({
              chunk_id: source.chunk_id ?? `chunk-${index}`,
              document_id: source.document_id ?? "Unknown",
              title: source.title ?? "Research",
              confidence: typeof source.confidence === "number" ? source.confidence : 0.8,
              excerpt: source.content ?? "",
            }));
            setLatestSources(normalizedSources);
          } else if (parsedData.type === "complete") {
            setThinkingLabel(undefined);
          } else if (parsedData.type === "error") {
            const errVal = parsedData.error;
            streamErr = typeof errVal === "string" ? errVal : String(errVal || "Failed to get response");
            break;
          }
        }

        if (streamErr) {
          break;
        }
      }

      reader.releaseLock();
      setSending(false);

      // Handle errors after stream completes
      if (streamErr) {
        clearTypingState(personaMessageId);
        let errorMsg = streamErr;
        if (errorMsg.toLowerCase().includes("overloaded")) {
          errorMsg = "The AI service is currently overloaded. Please try again in a few moments.";
        }

        setMessages((prev) => {
          const updated = [...prev];
          const personaMsg = updated.find((m) => m.id === personaMessageId);
          if (personaMsg) {
            personaMsg.content = errorMsg;
            personaMsg.role = "system";
          }
          return updated;
        });
        setThinkingLabel(undefined);
        notify(errorMsg);
        return;
      }

      setThinkingLabel(undefined);

      // Save new learnings after successful response
      if (newLearnings.length > 0 && activePersonaId) {
        const personaLearnings = newLearnings.filter((l) => l.personaId === activePersonaId);
        const globalLearnings = newLearnings.filter((l) => !l.personaId);

        if (personaLearnings.length > 0) {
          const existingPersonaLearnings = loadLearningsFromLocalStorage(activePersonaId);
          const mergedPersonaLearnings = mergeLearnings(existingPersonaLearnings, personaLearnings);
          saveLearningsToLocalStorage(activePersonaId, mergedPersonaLearnings);
        }
        if (globalLearnings.length > 0) {
          const existingGlobalLearnings = loadLearningsFromLocalStorage("global");
          const mergedGlobalLearnings = mergeLearnings(existingGlobalLearnings, globalLearnings);
          saveLearningsToLocalStorage("global", mergedGlobalLearnings);
        }
      }

      // Update URL with conversationId if not already set
      if (currentConversationId && !searchParams.get("conversationId")) {
        router.replace(`/admin/chat?conversationId=${currentConversationId}`);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      stopAudioQueue();
      clearTypingState(personaMessageId);

      // Get user-friendly error message
      let errorMessage = "Failed to send message. Please try again.";
      if (error instanceof Error) {
        errorMessage = error.message;
        // Check if it's an overloaded error
        if (error.message.includes("overloaded") || error.message.includes("Overloaded")) {
          errorMessage = "The AI service is currently overloaded. Please try again in a few moments.";
        }
      }

      setMessages((prev) => {
        const updated = [...prev];
        const personaMsg = updated.find((m) => m.id === personaMessageId);
        if (personaMsg) {
          personaMsg.content = errorMessage;
          personaMsg.role = "system";
        }
        return updated;
      });
      setThinkingLabel(undefined);

      // Show notification toast
      notify(errorMessage);
    } finally {
      setSending(false);
    }
  }, [
    activePersonaId,
    sending,
    input,
    messages,
    learnings,
    selectedJourney,
    personaProfile,
    activePersona,
    personaDisplayName,
    personaProfileCard,
    speechListening,
    voiceEnabled,
    user,
    pendingImageIds,
    pendingImages,
    currentConversationId,
  ]);

  useEffect(() => {
    handleSendRef.current = handleSend;
  }, [handleSend]);

  // Load journeys when dialog opens
  useEffect(() => {
    if (!activeProjectId) {
      setJourneys([]);
      return;
    }
    if (journeyDialogOpen && journeys.length === 0) {
      loadJourneys();
    }
  }, [journeyDialogOpen, activeProjectId]);

  // Load selected journey details when journey is selected
  useEffect(() => {
    if (selectedJourneyId) {
      loadJourneyDetails(selectedJourneyId);
    } else {
      setSelectedJourney(null);
      setSelectedPhases([]);
    }
  }, [selectedJourneyId]);

  const loadJourneys = async () => {
    try {
      setLoadingJourneys(true);
      if (!activeProjectId) {
        setJourneys([]);
        return;
      }
      const data = await journeysApi.listJourneys({ project_id: activeProjectId });
      setJourneys(data);
    } catch (error) {
      console.error("Failed to load journeys:", error);
    } finally {
      setLoadingJourneys(false);
    }
  };

  const loadJourneyDetails = async (journeyId: string) => {
    try {
      const journey = await journeysApi.getJourney(journeyId);
      setSelectedJourney(journey);
    } catch (error) {
      console.error("Failed to load journey details:", error);
    }
  };

  const handleAddPhasesToChat = () => {
    if (!selectedJourney || selectedPhases.length === 0) return;

    const phasesToAdd = selectedJourney.phases
      .filter((p) => selectedPhases.includes(p.id))
      .sort((a, b) => (a.phase_order || 0) - (b.phase_order || 0));

    // Format phases context
    const phasesContext = phasesToAdd
      .map((phase, index) => {
        let context = `Phase ${index + 1}: ${phase.name}`;
        if (phase.description) {
          context += `\nDescription: ${phase.description}`;
        }
        if (phase.elements && phase.elements.length > 0) {
          context += `\nMoments:`;
          phase.elements.forEach((element, elementIndex) => {
            context += `\n  ${elementIndex + 1}. ${element.element_type}: ${element.content}`;
          });
        }
        return context;
      })
      .join("\n\n");

    // Add as system message
    setMessages((prev) => [
      ...prev,
      {
        id: `journey-context-${Date.now()}`,
        role: "system",
        content: `Journey context added: "${selectedJourney.name}"\n\n${phasesContext}`,
      },
    ]);

    // Close dialog and reset
    setJourneyDialogOpen(false);
    setSelectedJourneyId(null);
    setSelectedPhases([]);
    setSelectedJourney(null);
    setActiveDialogTab("phases");
  };

  const handleVariableClick = (variable: VariableDefinition) => {
    // Füge Variable-Syntax in den Input ein
    const variableSyntax = variable.syntax;
    setInput((prev) => {
      // Versuche Cursor-Position zu finden, sonst am Ende einfügen
      const inputElement = document.querySelector('input[placeholder*="Ask"], textarea[placeholder*="Ask"]') as HTMLInputElement | HTMLTextAreaElement;
      if (inputElement && 'selectionStart' in inputElement) {
        const cursorPos = inputElement.selectionStart || prev.length;
        const newValue = prev.slice(0, cursorPos) + variableSyntax + prev.slice(cursorPos);
        // Setze Cursor nach der eingefügten Variable
        setTimeout(() => {
          const newPos = cursorPos + variableSyntax.length;
          inputElement.setSelectionRange(newPos, newPos);
          inputElement.focus();
        }, 0);
        return newValue;
      }
      return prev + variableSyntax;
    });
  };

  // Ersetzt Variablen in User-Nachrichten durch tatsächliche Werte
  const replaceMessageVariables = (message: string): string => {
    if (!message || !message.includes("${")) {
      return message; // Keine Variablen vorhanden
    }

    const normalizedPersonaProfile = personaProfile ? {
      name: personaProfile.name,
      fullName: personaProfile.fullName,
      headline: personaProfile.headline,
      bio: personaProfile.bio,
      age: personaProfile.age,
      location: personaProfile.location,
      gender: personaProfile.gender,
      media_affinity: personaProfile.media_affinity,
      interests: personaProfile.interests || [],
      colorPalette: personaProfile.colorPalette || [],
      attentionSpan: personaProfile.attentionSpan,
      socialMediaUsage: personaProfile.socialMediaUsage || [],
      values: personaProfile.values || [],
      traits: personaProfile.traits || {},
      painPoints: personaProfile.painPoints || [],
      goals: personaProfile.goals || [],
      communicationStyle: personaProfile.communicationStyle,
    } : {
      name: activePersona?.name || null,
      fullName: personaDisplayName || null,
      headline: personaProfileCard?.headline || activePersona?.headline || null,
      bio: null,
      age: null,
      location: personaProfileCard?.location || null,
      gender: null,
      media_affinity: null,
      interests: [],
      colorPalette: [],
      attentionSpan: null,
      socialMediaUsage: [],
      values: [],
      traits: {},
      painPoints: [],
      goals: [],
      communicationStyle: undefined,
    };

    // Erstelle ein Mapping aller verfügbaren Variablen
    const variables: Record<string, string> = {
      // Persona-Variablen
      persona_name: normalizedPersonaProfile.name || normalizedPersonaProfile.fullName || "",
      persona_fullname: normalizedPersonaProfile.fullName || normalizedPersonaProfile.name || "",
      persona_headline: normalizedPersonaProfile.headline || "",
      persona_bio: normalizedPersonaProfile.bio || "",
      persona_age: normalizedPersonaProfile.age?.toString() || "",
      persona_location: normalizedPersonaProfile.location || "",
      persona_gender: normalizedPersonaProfile.gender || "",
      persona_media_affinity: normalizedPersonaProfile.media_affinity?.toString() || "",
      persona_attention_span: normalizedPersonaProfile.attentionSpan || "",
      persona_interests: normalizedPersonaProfile.interests?.join(", ") || "",
      persona_values: normalizedPersonaProfile.values?.join(", ") || "",
      persona_color_palette: normalizedPersonaProfile.colorPalette?.join(", ") || "",
      persona_social_media_usage: normalizedPersonaProfile.socialMediaUsage?.join(", ") || "",
      persona_vocabulary: normalizedPersonaProfile.communicationStyle?.vocabulary?.join(", ") || "",
      persona_sentence_structure: normalizedPersonaProfile.communicationStyle?.sentenceStructure || "",
      persona_skepticism_level: normalizedPersonaProfile.communicationStyle?.skepticismLevel?.toString() || "",
      persona_pain_points: normalizedPersonaProfile.painPoints?.map(p => p.label || "").filter(Boolean).join(", ") || "",
      persona_goals: normalizedPersonaProfile.goals?.map(g => g.label || "").filter(Boolean).join(", ") || "",
      persona_traits: normalizedPersonaProfile.traits ? Object.entries(normalizedPersonaProfile.traits)
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ") : "",
      existing_traits: normalizedPersonaProfile.traits ? Object.entries(normalizedPersonaProfile.traits)
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ") : "",

      // Journey-Variablen
      journey_name: selectedJourney?.name || "",
      journey_type: selectedJourney?.journey_type || "",
      journey_description: selectedJourney?.description || "",
      // Note: target_group_summary and persona_summaries are not available in JourneyResponse
      target_group_summary: "",
      persona_summaries: "",
    };

    // Phase-Variablen (aus currentPhase)
    const currentPhase = getCurrentPhase(messages, selectedJourney || undefined);
    if (currentPhase) {
      variables.phase_name = currentPhase.name || "";
      variables.phase_description = currentPhase.description || "";
      variables.phase_expected_emotion = currentPhase.expected_emotion || "";
    }

    // Phasen-Liste
    if (selectedJourney?.phases && selectedJourney.phases.length > 0) {
      const sortedPhases = [...selectedJourney.phases].sort((a, b) => (a.phase_order || 0) - (b.phase_order || 0));
      variables.existing_phases_summary = sortedPhases
        .map((p, idx) => `Phase ${idx + 1}: ${p.name}`)
        .join(", ");
      variables.existing_phases_count = sortedPhases.length.toString();

      const lastPhase = sortedPhases[sortedPhases.length - 1];
      if (lastPhase) {
        variables.last_phase_summary = `Phase ${sortedPhases.length}: ${lastPhase.name}${lastPhase.description ? ` - ${lastPhase.description}` : ""}`;
        variables.last_phase_name = lastPhase.name || "";
      }
    }

    // Ersetze alle Variablen im Format ${variable_name}
    let replacedMessage = message;
    const variablePattern = /\$\{([^}]+)\}/g;

    replacedMessage = replacedMessage.replace(variablePattern, (match, variableName) => {
      const trimmedName = variableName.trim();
      const normalizedName = trimmedName.toLowerCase();

      // Suche nach exakter Übereinstimmung (case-insensitive)
      const exactMatch = Object.entries(variables).find(([key]) =>
        key.toLowerCase() === normalizedName
      );

      if (exactMatch) {
        return exactMatch[1] || match; // Wenn leer, behalte die Variable
      }

      // Versuche mit Unterstrichen statt Bindestrichen
      const altName = normalizedName.replace(/-/g, "_");
      const altMatch = Object.entries(variables).find(([key]) =>
        key.toLowerCase() === altName
      );

      if (altMatch) {
        return altMatch[1] || match;
      }

      // Wenn nicht gefunden, gib die Variable zurück (nicht ersetzt)
      return match;
    });

    return replacedMessage;
  };
  replaceMessageVariablesRef.current = replaceMessageVariables;

  const compressImage = (file: File, maxWidth: number = 1024, maxHeight: number = 1024, quality: number = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Calculate new dimensions
          if (width > height) {
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to compress image'));
                return;
              }
              const reader = new FileReader();
              reader.onload = () => {
                if (typeof reader.result === 'string') {
                  resolve(reader.result);
                } else {
                  reject(new Error('Failed to read compressed image'));
                }
              };
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            },
            file.type,
            quality
          );
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    // Filtere nur Bilder
    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));

    // Komprimiere und konvertiere Bilder zu Base64 data URLs
    try {
      const base64Images = await Promise.all(
        imageFiles.map(file => compressImage(file))
      );
      setAttachedImages((prev) => [...prev, ...base64Images]);
    } catch (error) {
      console.error('Failed to compress/convert images:', error);
    }
  };

  const handleAddAttachmentsToChat = async () => {
    if (attachedImages.length === 0) {
      return;
    }

    // Lade Bilder hoch und erhalte Image-IDs
    try {
      const apiBase = getChatApiBase();
      // Check if apiBase already contains /chat (might be configured that way)
      // The images router is registered with prefix /chat/images
      // If apiBase already ends with /chat, we use /images/upload, otherwise /chat/images/upload
      const uploadUrl = apiBase.endsWith('/chat')
        ? `${apiBase}/images/upload`
        : `${apiBase}/chat/images/upload`;

      const uploadPromises = attachedImages.map(async (imageDataUrl) => {
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ image: imageDataUrl }),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => response.statusText || "Unknown error");
          throw new Error(`Failed to upload image: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        return data.image_id;
      });

      const imageIds = await Promise.all(uploadPromises);

      // Speichere Image-IDs für Backend und Base64-Daten für Anzeige
      setPendingImageIds((prev) => [...prev, ...imageIds]);
      setPendingImages((prev) => [...prev, ...attachedImages]);

      // Schließe Dialog und setze zurück
      setJourneyDialogOpen(false);
      setAttachedImages([]);
      setActiveDialogTab("phases");

      // Optional: Fokussiere den Input, damit User direkt tippen kann
      setTimeout(() => {
        const inputElement = document.querySelector('input[placeholder*="Ask"], textarea[placeholder*="Ask"]') as HTMLInputElement | HTMLTextAreaElement;
        inputElement?.focus();
      }, 100);
    } catch (error) {
      console.error("Failed to upload images:", error);
      const msg = error instanceof Error ? error.message : t("adminChat.imageUploadFailed");
      notify(msg);
    }
  };

  // Load conversation from URL on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const conversationIdParam = searchParams.get("conversationId");
    const personaIdParam = searchParams.get("personaId");
    if (conversationIdParam) {
      const conversation = loadConversationFromLocalStorage(conversationIdParam);
      if (conversation) {
        setCurrentConversationId(conversation.metadata.conversationId);
        setConversationTitle(conversation.metadata.title);
        setMessages(conversation.messages);
        setActivePersonaId(conversation.metadata.personaId);
        if (conversation.metadata.personaId) {
          ensureChatPromptForPersona(conversation.metadata.personaId);
        }
        if (conversation.learnings) {
          setLearnings(conversation.learnings);
        }
        if (conversation.systemPrompt) {
          setCurrentSystemPrompt(conversation.systemPrompt);
        }
        // Restore journey context if available
        if (conversation.metadata.journeyId) {
          setSelectedJourneyId(conversation.metadata.journeyId);
          // Note: Journey details would need to be loaded separately
        }
        if (conversation.metadata.selectedPhases) {
          setSelectedPhases(conversation.metadata.selectedPhases);
        }
      }
    } else if (personaIdParam) {
      setActivePersonaId(personaIdParam);
      ensureChatPromptForPersona(personaIdParam);
    }
  }, [searchParams, ensureChatPromptForPersona]);

  // Create new conversation when persona changes (if no conversationId in URL and no messages)
  useEffect(() => {
    if (activePersonaId && !searchParams.get("conversationId") && messages.length === 0 && !currentConversationId) {
      const newConversationId = generateConversationId();
      setCurrentConversationId(newConversationId);
      setConversationTitle("");
      // Don't clear messages here as they might be loaded from conversation
    }
  }, [activePersonaId, searchParams, messages.length, currentConversationId]);

  // Load learnings when persona changes
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (activePersonaId) {
      const personaLearnings = loadLearningsFromLocalStorage(activePersonaId);
      const globalLearnings = loadLearningsFromLocalStorage("global");
      setLearnings([...personaLearnings, ...globalLearnings]);
    } else {
      setLearnings([]);
    }
  }, [activePersonaId]);

  // Update system prompt when persona changes or when context changes
  useEffect(() => {
    if (!activePersona || !activePersonaId) {
      setCurrentSystemPrompt(undefined);
      return;
    }

    const normalizedPersonaProfile: PersonaProfile = {
      name: activePersona.name,
      fullName: activePersona.profile?.fullName ?? activePersona.profile?.name ?? activePersona.name,
      headline: activePersona.profile?.headline ?? activePersona.profileCard?.headline ?? activePersona.headline ?? null,
      bio: activePersona.profile?.bio ?? null,
      age: activePersona.profile?.age ?? null,
      location: activePersona.profile?.location ?? null,
      gender: activePersona.profile?.gender ?? null,
      media_affinity: activePersona.profile?.media_affinity ?? null,
      interests: activePersona.profile?.interests ?? [],
      colorPalette: activePersona.profile?.colorPalette ?? [],
      attentionSpan: activePersona.profile?.attentionSpan ?? null,
      socialMediaUsage: activePersona.profile?.socialMediaUsage ?? [],
      values: activePersona.profile?.values ?? [],
      traits: activePersona.profile?.traits ?? {},
      painPoints: activePersona.profile?.painPoints ?? [],
      goals: activePersona.profile?.goals ?? [],
      communicationStyle: activePersona.profile?.communicationStyle ?? undefined,
    };

    const systemPrompt = buildAdaptiveSystemPrompt({
      persona: normalizedPersonaProfile,
      journeyPhases: selectedJourney?.phases,
      conversationHistory: messages,
      learnings: learnings,
      currentPhase: selectedJourney?.phases?.find((p) => selectedPhases.includes(p.id)) || undefined,
      messageCount: messages.filter((m) => m.role === "user").length,
      baseSystemPrompt: activePersona.systemPrompt ?? null, // Use system prompt from database
    });

    setCurrentSystemPrompt(systemPrompt);
  }, [activePersona, activePersonaId, selectedJourney, selectedPhases, messages, learnings]);

  // Update header with persona or target group info
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (chatMode === "target_group" && activeTargetGroupId) {
      const tg = availableTargetGroups.find((g) => g.id === activeTargetGroupId);
      setHeaderContent(
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1 }}>
          <MsqdxIcon name="groups" customSize={24} />
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {tg?.name ?? activeTargetGroupId}
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {t("adminChat.chatMode.targetGroup")} · {targetGroupPersonas.length} {t("adminChat.targetGroup.personas")}
          </Typography>
        </Box>
      );
    } else if (activePersonaId && activePersona) {
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
            "&:hover": {
              backgroundColor: alpha(theme.palette.text.primary, 0.08)
            }
          }}
        >
          <Avatar
            src={safeAvatarSrc(activePersona.image_url ?? null, activePersonaId ?? undefined) ?? undefined}
            alt={activePersona.name}
            sx={{ width: 36, height: 36 }}
          >
            {(activePersona?.name ?? "").charAt(0)}
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
    } else {
      setHeaderContent(null);
    }

    return () => {
      setHeaderContent(null);
    };
  }, [chatMode, activePersonaId, activePersona, activeTargetGroupId, availableTargetGroups, targetGroupPersonas.length, personaDisplayName, setHeaderContent, theme, t]);

  // Auto-save conversation
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (messages.length > 0 && activePersonaId && currentConversationId && activePersona) {
      // Debounce: Speichere nur nach 2 Sekunden Inaktivität
      const timer = setTimeout(() => {
        // Prüfe ob Konversation bereits existiert, um createdAt zu erhalten
        const existing = loadConversationFromLocalStorage(currentConversationId);
        const createdAt = existing?.metadata.createdAt || new Date();

        const conversation: Conversation = {
          metadata: {
            conversationId: currentConversationId,
            personaId: activePersonaId,
            personaName: activePersona.name || "Unknown",
            title: conversationTitle || generateConversationTitle(messages),
            createdAt: createdAt,
            updatedAt: new Date(),
            messageCount: messages.length,
            journeyId: selectedJourney?.id,
            journeyName: selectedJourney?.name,
            selectedPhases: selectedPhases.length > 0 ? selectedPhases : undefined,
            isArchived: false,
          },
          messages: messages,
          learnings: learnings,
        };
        saveConversationToLocalStorage(conversation);

        // Update conversationTitle if it was auto-generated
        if (!conversationTitle) {
          setConversationTitle(conversation.metadata.title);
        }
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [messages, activePersonaId, currentConversationId, conversationTitle, selectedJourney, selectedPhases, learnings, activePersona]);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        position: "relative",
        height: "100%",
        minHeight: 0
      }}
    >
      {/* Mode switch + Selection (Persona or Target group) */}
      {showSelectionState && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
            minHeight: 0,
            p: 2
          }}
        >
          <Tabs
            value={chatMode}
            onChange={(_, v: "persona" | "target_group") => {
              setChatMode(v);
              if (v === "persona") setActiveTargetGroupId(undefined);
              else setActivePersonaId(undefined);
            }}
            sx={{ mb: 2, minHeight: 40 }}
          >
            <Tab label={t("adminChat.chatMode.persona")} value="persona" />
            <Tab label={t("adminChat.chatMode.targetGroup")} value="target_group" />
          </Tabs>
          {chatMode === "persona" && (
            <Stack
              spacing={2.5}
              alignItems="center"
              textAlign="center"
              sx={{
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
                {t("adminChat.choosePersonaTitle")}
              </Typography>
              <Typography variant="body2">
                {t("adminChat.choosePersonaSubtitle")}
              </Typography>
              <Button
                variant="contained"
                size="large"
                startIcon={<MsqdxIcon name="person_add" customSize={22} />}
                onClick={(event) => setPersonaMenuAnchor(event.currentTarget)}
                disabled={loadingPersonas}
                sx={{ borderRadius: 999, px: 4 }}
              >
                {loadingPersonas ? t("adminChat.loadingPersonas") : t("adminChat.choosePersona")}
              </Button>
              {loadingPersonas && <CircularProgress size={28} />}
            </Stack>
          )}
          {chatMode === "target_group" && (
            <Stack
              spacing={2}
              alignItems="center"
              sx={{
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
                {t("adminChat.targetGroup.selectTargetGroup")}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {t("adminChat.targetGroup.selectTargetGroupSubtitle")}
              </Typography>
              <FormControl fullWidth size="medium" sx={{ minWidth: 260 }}>
                <InputLabel>{t("adminChat.targetGroup.targetGroup")}</InputLabel>
                <Select
                  value={activeTargetGroupId ?? ""}
                  onChange={(e) => setActiveTargetGroupId(e.target.value || undefined)}
                  label={t("adminChat.targetGroup.targetGroup")}
                  disabled={loadingTargetGroups}
                >
                  <MenuItem value="">{t("adminChat.targetGroup.none")}</MenuItem>
                  {availableTargetGroups.map((tg) => (
                    <MenuItem key={tg.id} value={tg.id}>
                      {tg.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {loadingTargetGroupPersonas && <CircularProgress size={24} />}
              {activeTargetGroupId && !loadingTargetGroupPersonas && (
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {targetGroupPersonas.length === 0
                    ? t("adminChat.targetGroup.noPersonas")
                    : t("adminChat.targetGroup.personaCount", { count: targetGroupPersonas.length })}
                </Typography>
              )}
            </Stack>
          )}
        </Box>
      )}

      {/* Chat Interface - Persona mode or Target group mode with selection */}
      {showChatState && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            minHeight: 0,
            position: "relative"
          }}
        >
          {/* Status Bar */}
          {(thinkingLabel || sending || sendingTargetGroup) && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                padding: "0.5rem 1rem",
                flexShrink: 0
              }}
            >
              {thinkingLabel && !sendingTargetGroup && (
                <Typography variant="body2" sx={{ color: alpha(theme.palette.text.primary, 0.7) }}>
                  {thinkingLabel}
                </Typography>
              )}
              {sending && !sendingTargetGroup && (
                <Stack direction="row" spacing={1} alignItems="center">
                  <CircularProgress size={16} />
                  <Typography variant="body2">{t("adminChat.sending")}</Typography>
                </Stack>
              )}
              {sendingTargetGroup && (
                <Stack direction="row" spacing={1} alignItems="center">
                  <CircularProgress size={16} />
                  <Typography variant="body2">{t("adminChat.targetGroup.askingAll")}</Typography>
                </Stack>
              )}
            </Box>
          )}

          {/* Scroll area fills remaining height; composer overlays bottom (see form below) */}
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              position: "relative",
              width: "100%",
            }}
          >
          {/* Chat Messages - Persona thread, or Target group rounds (side-by-side), or Tavus Video */}
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              overflowY: "auto",
              overflowX: "hidden",
              padding: "1rem",
              paddingBottom: { xs: "148px", sm: "128px" },
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent:
                videoEnabled && tavusSessionConfig
                  ? "flex-start"
                  : chatMode === "target_group"
                    ? (targetGroupRounds.length === 0 && !targetGroupStreamingRound ? "center" : "flex-start")
                    : messages.length === 0
                      ? "center"
                      : "flex-start"
            }}
          >
            {chatMode === "target_group" ? (
              targetGroupRounds.length === 0 && !targetGroupStreamingRound ? (
                <Box
                  sx={{
                    maxWidth: 480,
                    width: "100%",
                    textAlign: "center",
                    px: 2,
                    py: 3,
                    borderRadius: 4,
                    border: "1px solid var(--color-neutral)",
                    backgroundColor: alpha(theme.palette.background.paper, 0.8)
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                    {t("adminChat.targetGroup.askAllTitle")}
                  </Typography>
                  <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                    {t("adminChat.targetGroup.askAllSubtitle")}
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ pt: 2.5, pl: 2.5 }}>
                  <Stack spacing={3} sx={{ width: "100%", maxWidth: 1200 }}>
                  {targetGroupRounds.map((round, roundIndex) => (
                    <Box key={roundIndex}>
                      <Stack spacing={0.5} alignItems="flex-end" sx={{ mb: 1 }}>
                        <Typography variant="caption" sx={{ letterSpacing: 1, textTransform: "uppercase", color: "text.secondary" }}>
                          You
                        </Typography>
                        <Box
                          sx={{
                            alignSelf: "flex-end",
                            maxWidth: "85%",
                            px: 2,
                            py: 1.5,
                            borderRadius: "36px 12px 36px 36px",
                            border: "1px solid var(--color-secondary-dx-orange)",
                            backgroundColor: theme.palette.background.paper
                          }}
                        >
                          <Typography variant="body2">{round.userMessage}</Typography>
                        </Box>
                      </Stack>
                      <Typography variant="caption" sx={{ display: "block", mb: 1, color: "text.secondary" }}>
                        {t("adminChat.targetGroup.responsesFrom")}
                      </Typography>
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)", lg: "repeat(4, 1fr)" },
                          gap: 1.5,
                          overflowX: "auto",
                          overflowY: "visible",
                          alignItems: "start"
                        }}
                      >
                        {round.responses.map((r, cardIndex) => (
                          <Paper
                            key={r.personaId}
                            variant="outlined"
                            sx={{
                              position: "relative",
                              p: 1.5,
                              borderColor: "var(--color-secondary-dx-pink)",
                              borderWidth: 1,
                              borderRadius: 2,
                              animation: "msqdxCardEnter var(--msqdx-transition) ease-out both",
                              animationDelay: `${cardIndex * 60}ms`
                            }}
                          >
                            {r.image_url && (
                              <Avatar
                                src={safeAvatarSrc(r.image_url, r.personaId)}
                                sx={{
                                  position: "absolute",
                                  left: 0,
                                  top: 0,
                                  transform: "translate(-50%, -50%)",
                                  width: 40,
                                  height: 40,
                                  border: "2px solid",
                                  borderColor: "var(--color-secondary-dx-pink)",
                                  bgcolor: "background.paper"
                                }}
                              />
                            )}
                            <Box sx={{ pt: r.image_url ? 2.5 : 0, pl: r.image_url ? 2.5 : 0 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                {r.personaName}
                              </Typography>
                              {r.reasoning?.trim() ? (
                                <Accordion
                                  disableGutters
                                  elevation={0}
                                  sx={{
                                    mb: 1,
                                    bgcolor: "transparent",
                                    "&:before": { display: "none" },
                                  }}
                                >
                                  <AccordionSummary
                                    expandIcon={<MsqdxIcon name="expand_more" customSize={14} />}
                                    sx={{ px: 0, minHeight: 36, "& .MuiAccordionSummary-content": { my: 0 } }}
                                  >
                                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                      {t("chat.reasoningSection")}
                                    </Typography>
                                  </AccordionSummary>
                                  <AccordionDetails sx={{ px: 0, pt: 0 }}>
                                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", opacity: 0.88, color: "text.secondary" }}>
                                      {r.reasoning}
                                    </Typography>
                                  </AccordionDetails>
                                </Accordion>
                              ) : null}
                              <ChatMessageMarkdown content={r.content} dense />
                            </Box>
                          </Paper>
                        ))}
                      </Box>
                    </Box>
                  ))}
                  {targetGroupStreamingRound && (
                    <Box>
                      <Stack spacing={0.5} alignItems="flex-end" sx={{ mb: 1 }}>
                        <Typography variant="caption" sx={{ letterSpacing: 1, textTransform: "uppercase", color: "text.secondary" }}>
                          You
                        </Typography>
                        <Box
                          sx={{
                            alignSelf: "flex-end",
                            maxWidth: "85%",
                            px: 2,
                            py: 1.5,
                            borderRadius: "36px 12px 36px 36px",
                            border: "1px solid var(--color-secondary-dx-orange)",
                            backgroundColor: theme.palette.background.paper
                          }}
                        >
                          <Typography variant="body2">{targetGroupStreamingRound.userMessage}</Typography>
                        </Box>
                      </Stack>
                      <Typography variant="caption" sx={{ display: "block", mb: 1, color: "text.secondary" }}>
                        {t("adminChat.targetGroup.responsesFrom")}
                      </Typography>
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)", lg: "repeat(4, 1fr)" },
                          gap: 1.5,
                          overflowX: "auto",
                          overflowY: "visible",
                          alignItems: "start"
                        }}
                      >
                        {targetGroupStreamingRound.responses.map((slot, cardIndex) => (
                          <Paper
                            key={slot.personaId}
                            variant="outlined"
                            sx={{
                              position: "relative",
                              p: 1.5,
                              borderColor: slot.error ? "error.main" : "var(--color-secondary-dx-pink)",
                              borderWidth: 1,
                              borderRadius: 2,
                              animation: "msqdxCardEnter var(--msqdx-transition) ease-out both",
                              animationDelay: `${cardIndex * 60}ms`
                            }}
                          >
                            {slot.image_url && (
                              <Avatar
                                src={safeAvatarSrc(slot.image_url, slot.personaId)}
                                sx={{
                                  position: "absolute",
                                  left: 0,
                                  top: 0,
                                  transform: "translate(-50%, -50%)",
                                  width: 40,
                                  height: 40,
                                  border: "2px solid",
                                  borderColor: slot.error ? "error.main" : "var(--color-secondary-dx-pink)",
                                  bgcolor: "background.paper"
                                }}
                              />
                            )}
                            <Box sx={{ pt: slot.image_url ? 2.5 : 0, pl: slot.image_url ? 2.5 : 0 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                {slot.personaName}
                              </Typography>
                              {slot.error ? (
                                <Typography variant="body2" sx={{ color: "error.main", whiteSpace: "pre-wrap" }}>
                                  {slot.content || slot.error}
                                </Typography>
                              ) : (
                                <>
                                  {slot.reasoning?.trim() ? (
                                    <Accordion
                                      disableGutters
                                      elevation={0}
                                      sx={{
                                        mb: 1,
                                        bgcolor: "transparent",
                                        "&:before": { display: "none" },
                                      }}
                                    >
                                      <AccordionSummary
                                        expandIcon={<MsqdxIcon name="expand_more" customSize={14} />}
                                        sx={{ px: 0, minHeight: 36, "& .MuiAccordionSummary-content": { my: 0 } }}
                                      >
                                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                          {t("chat.reasoningSection")}
                                        </Typography>
                                      </AccordionSummary>
                                      <AccordionDetails sx={{ px: 0, pt: 0 }}>
                                        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", opacity: 0.88, color: "text.secondary" }}>
                                          {slot.reasoning}
                                        </Typography>
                                      </AccordionDetails>
                                    </Accordion>
                                  ) : null}
                                  <ChatMessageMarkdown content={slot.content} dense />
                                  {!slot.done && (
                                    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, mt: 0.5 }}>
                                      <CircularProgress size={14} />
                                      <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                        …
                                      </Typography>
                                    </Box>
                                  )}
                                </>
                              )}
                            </Box>
                          </Paper>
                        ))}
                      </Box>
                    </Box>
                  )}
                  </Stack>
                </Box>
              )
            ) : videoEnabled && tavusSessionConfig ? (
              <Box sx={{ width: "100%", height: "100%", minHeight: 0, display: "flex", flexDirection: "column", flex: 1 }}>
                <Box sx={{ flexShrink: 0, mb: 1.5 }}>
                  <button
                    type="button"
                    className="msqdx-glass-button --ghost"
                    onClick={() => { setVideoEnabled(false); setTavusSessionConfig(null); }}
                  >
                    <MsqdxIcon name="keyboard" customSize={16} />
                    {t("adminChat.backToTextChat")}
                  </button>
                </Box>
                <TavusVideoPanel
                  sessionConfig={tavusSessionConfig}
                  personaName={personaDisplayName ?? undefined}
                />
              </Box>
            ) : messages.length === 0 ? (
              <Box
                sx={{
                  maxWidth: 480,
                  width: "100%",
                  textAlign: "center",
                  px: 2,
                  py: 3,
                  borderRadius: 4,
                  border: "1px solid var(--color-neutral)",
                  backgroundColor: alpha(theme.palette.background.paper, 0.8)
                }}
              >
                <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
                  <Avatar
                    src={safeAvatarSrc(activePersona?.image_url ?? null, activePersonaId ?? undefined) ?? undefined}
                    alt={personaDisplayName}
                    sx={{
                      width: 160,
                      height: 160,
                      border: "3px solid var(--color-secondary-dx-green)",
                      boxShadow: 2
                    }}
                  >
                    {(personaDisplayName ?? "").charAt(0) ? (personaDisplayName ?? "").charAt(0).toUpperCase() : <MsqdxIcon name="person" customSize={80} />}
                  </Avatar>
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                  Chat with {personaDisplayName}
                </Typography>
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                  Start the conversation — type your message below and hit send.
                </Typography>
              </Box>
            ) : (
              <Box sx={{ width: "100%", minHeight: 0, flex: 1, alignSelf: "stretch", display: "flex", flexDirection: "column" }}>
                <MsqdxGlassChatPanel messages={messages} systemPrompt={currentSystemPrompt} />
              </Box>
            )}
          </Box>

          {/* Input bar overlays message area (does not shrink scroll height) */}
          {!videoEnabled && (
          <Box
            component="form"
            onSubmit={(event) => {
              event.preventDefault();
              if (chatMode === "target_group") {
                void handleSendTargetGroup();
              } else {
                void handleSend();
              }
            }}
            sx={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 20,
              padding: "1rem",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              pointerEvents: "none",
              "& > *": { pointerEvents: "auto" },
            }}
          >
            <Box
              sx={{
                width: "100%",
                maxWidth: "720px",
                mx: "auto",
                padding: "0.75rem 1rem",
                border: "1px solid var(--color-neutral)",
                borderRadius: "var(--msqdx-radius-3xl, 24px)",
                backgroundColor: alpha(theme.palette.background.paper, 0.94),
                backdropFilter: "saturate(180%) blur(12px)",
                boxShadow: theme.palette.mode === "dark"
                  ? "0 8px 32px rgba(0,0,0,0.45)"
                  : "0 8px 32px rgba(0,0,0,0.08)",
              }}
            >
            <Box
              sx={{
                display: "flex",
                gap: 1,
                alignItems: "center",
                width: "100%",
              }}
            >
              <Tooltip title={t("adminChat.addJourneyPhases")}>
                <Badge
                  badgeContent={pendingImages.length > 0 ? pendingImages.length : 0}
                  color="primary"
                  overlap="circular"
                  sx={{
                    "& .MuiBadge-badge": {
                      right: 4,
                      top: 4,
                      minWidth: "18px",
                      height: "18px",
                      fontSize: "0.7rem",
                      fontWeight: 600
                    }
                  }}
                >
                  <IconButton
                    onClick={() => setJourneyDialogOpen(true)}
                    disabled={chatMode !== "persona" || !activePersonaId || sending}
                    sx={{
                      backgroundColor: alpha(theme.palette.text.primary, 0.08),
                      borderRadius: 999
                    }}
                  >
                    <MsqdxIcon name="add" customSize={22} />
                  </IconButton>
                </Badge>
              </Tooltip>
              {chatMode === "persona" && (
              <Tooltip title={t("adminChat.shareChatLink")}>
                <IconButton
                  onClick={() => setShareDialogOpen(true)}
                  disabled={!activePersonaId || !activeProjectId}
                  sx={{
                    backgroundColor: alpha(theme.palette.text.primary, 0.08),
                    borderRadius: 999
                  }}
                >
                  <MsqdxIcon name="share" customSize={22} />
                </IconButton>
              </Tooltip>
              )}
              <Tooltip title={whisperRecording ? t("adminChat.stopRecording") : t("adminChat.startVoiceInput")}>
                <IconButton
                  onClick={handleMicToggle}
                  disabled={sending || whisperTranscribing}
                  sx={{
                    backgroundColor: (whisperRecording || whisperTranscribing)
                      ? "var(--color-secondary-dx-pink-tint)"
                      : alpha(theme.palette.text.primary, 0.08),
                    borderRadius: 999
                  }}
                >
                  <MsqdxIcon name="keyboard_voice" customSize={22} />
                </IconButton>
              </Tooltip>
              <MsqdxInput
                fullWidth
                placeholder={t("adminChat.placeholder")}
                value={input}
                disabled={inputDisabled}
                onChange={(event) => setInput(event.target.value)}
                size="large"
                sx={{
                  ...INPUT_ACCENT_SX,
                  "& .msqdx-input-wrapper": {
                    ...INPUT_ACCENT_SX["& .msqdx-input-wrapper"],
                    borderRadius: 999,
                  },
                }}
              />
              <Tooltip title={t("adminChat.togglePlayback")}>
                <IconButton
                  onClick={handleVoiceToggle}
                  sx={{
                    backgroundColor: voiceEnabled ? "var(--color-secondary-dx-green)" : alpha(theme.palette.text.primary, 0.08),
                    borderRadius: 999
                  }}
                >
                  <MsqdxIcon name="headphones" customSize={22} />
                </IconButton>
              </Tooltip>
              <Tooltip title={videoEnabled ? t("adminChat.exitVideo") : t("adminChat.videoTavus")}>
                <IconButton
                  onClick={() => void handleVideoToggle()}
                  disabled={!activePersonaId || tavusSessionLoading}
                  sx={{
                    backgroundColor: videoEnabled ? "var(--color-secondary-dx-green)" : alpha(theme.palette.text.primary, 0.08),
                    borderRadius: 999
                  }}
                >
                  {tavusSessionLoading ? (
                    <CircularProgress size={22} color="inherit" />
                  ) : (
                    <MsqdxIcon name="videocam" customSize={22} />
                  )}
                </IconButton>
              </Tooltip>
              <IconButton
                type="submit"
                disabled={sendDisabled}
                sx={{
                  backgroundColor: sendDisabled
                    ? alpha(theme.palette.text.primary, 0.2)
                    : "var(--color-secondary-dx-green)",
                  color: "#ffffff",
                  borderRadius: 999
                }}
              >
                <MsqdxIcon name="send" customSize={22} />
              </IconButton>
            </Box>
            {(whisperRecording || whisperTranscribing || whisperError || speechListening || speechError) && (
              <Box sx={{ textAlign: "center", mt: 1 }}>
                <Typography
                  variant="caption"
                  sx={{
                    color: (whisperError || speechError)
                      ? theme.palette.error.main
                      : alpha(theme.palette.text.primary, 0.6)
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
              </Box>
            )}
            </Box>
          </Box>
          )}
          </Box>
        </Box>
      )}

      {/* Evidence Section - Outside of chat interface container */}
      {activePersonaId && latestSources && latestSources.length > 0 && (
        <Box sx={{ mt: 2, maxWidth: "720px", mx: "auto", width: "100%" }}>
          <Button
            variant="text"
            color="primary"
            startIcon={<MsqdxIcon name="info" customSize={18} />}
            endIcon={
              <MsqdxIcon
                name="expand_more"
                customSize={20}
                style={{
                  transform: showEvidence ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 150ms ease"
                }}
              />
            }
            onClick={() => setShowEvidence((prev) => !prev)}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            {showEvidence ? "Hide details" : "Show details"}
          </Button>
          <Collapse
            in={showEvidence}
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
                borderColor: "var(--color-neutral)"
              }}
            >
              <List disablePadding>
                {latestSources.map((source, index) => (
                  <Box key={`${source.chunk_id}-${index}`}>
                    <ListItem alignItems="flex-start" disableGutters>
                      <ListItemAvatar>
                        <MsqdxIcon
                          name="description"
                          customSize={22}
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
                    {index < latestSources.length - 1 && (
                      <Divider variant="middle" sx={{ my: 1, borderColor: "var(--color-neutral)" }} />
                    )}
                  </Box>
                ))}
              </List>
            </Paper>
          </Collapse>
        </Box>
      )}

      {/* Context Dialog with Tabs */}
      <Dialog
        open={journeyDialogOpen}
        onClose={() => {
          // Remove focus from any button inside dialog before closing to prevent aria-hidden error
          const activeElement = document.activeElement as HTMLElement;
          if (activeElement && activeElement.closest('[role="dialog"]')) {
            activeElement.blur();
          }
          setJourneyDialogOpen(false);
          setSelectedJourneyId(null);
          setSelectedPhases([]);
          setSelectedJourney(null);
          setActiveDialogTab("phases");
          setAttachedImages([]);
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: "40px",
            backgroundColor: "var(--color-neutral)",
            border: "5px solid var(--audion-light-border-color, #0f172a)",
            maxHeight: "80vh"
          }
        }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 0.75, pb: 1, pt: 2.5, px: 3 }}>
          <MsqdxIcon name="add_circle" customSize={16} />
          <Typography variant="body2" component="span" sx={{ fontSize: "0.8125rem", fontWeight: 600 }}>
            Add Context
          </Typography>
        </DialogTitle>

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: "divider", px: 3 }}>
          <Tabs
            value={activeDialogTab}
            onChange={(_, newValue) => setActiveDialogTab(newValue)}
            sx={{
              minHeight: "auto",
              "& .MuiTab-root": {
                minHeight: "auto",
                padding: "0.5rem 1rem",
                fontSize: "0.75rem",
                textTransform: "none",
                fontWeight: 500
              }
            }}
          >
            <Tab
              value="phases"
              label={t("adminChat.journeyPhases")}
              icon={<MsqdxIcon name="route" customSize={14} />}
              iconPosition="start"
            />
            <Tab
              value="variables"
              label={t("adminChat.variables")}
              icon={<MsqdxIcon name="code" customSize={14} />}
              iconPosition="start"
            />
            <Tab
              value="attachments"
              label={t("adminChat.attachments")}
              icon={<MsqdxIcon name="image" customSize={14} />}
              iconPosition="start"
            />
          </Tabs>
        </Box>

        <DialogContent sx={{ px: 3, py: 2, minHeight: "300px" }}>
          {/* Tab: Journey Phases */}
          {activeDialogTab === "phases" && (
            <>
              {loadingJourneys ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                  <CircularProgress size={20} />
                </Box>
              ) : (
                <Stack spacing={1.5}>
                  {/* Journey Selection */}
                  <FormControl fullWidth size="small">
                    <InputLabel sx={{ fontSize: "0.75rem" }}>{t("adminChat.journey")}</InputLabel>
                    <Select
                      value={selectedJourneyId || ""}
                      onChange={(e) => setSelectedJourneyId(e.target.value || null)}
                      label={t("adminChat.journey")}
                      sx={{ fontSize: "0.8125rem", "& .MuiSelect-select": { py: 0.75 } }}
                    >
                      {journeys.length === 0 ? (
                        <MenuItem disabled sx={{ fontSize: "0.75rem" }}>{t("adminChat.noneAvailable")}</MenuItem>
                      ) : (
                        journeys.map((journey) => (
                          <MenuItem key={journey.id} value={journey.id} sx={{ fontSize: "0.8125rem", py: 0.5 }}>
                            <Box>
                              <Typography variant="caption" fontWeight={500} sx={{ fontSize: "0.8125rem", display: "block" }}>
                                {journey.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.6875rem" }}>
                                {journey.phases.length} Phase{journey.phases.length !== 1 ? "s" : ""}
                              </Typography>
                            </Box>
                          </MenuItem>
                        ))
                      )}
                    </Select>
                  </FormControl>

                  {/* Phases List */}
                  {selectedJourney && selectedJourney.phases.length > 0 && (
                    <Box sx={{ maxHeight: "240px", overflowY: "auto" }}>
                      <Typography variant="caption" sx={{ mb: 0.75, fontWeight: 600, display: "block", fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Phases:
                      </Typography>
                      <Stack spacing={0.5}>
                        {selectedJourney.phases
                          .sort((a, b) => (a.phase_order || 0) - (b.phase_order || 0))
                          .map((phase) => (
                            <Paper
                              key={phase.id}
                              variant="outlined"
                              sx={{
                                p: 0.75,
                                backgroundColor: selectedPhases.includes(phase.id)
                                  ? alpha(theme.palette.primary.main, 0.08)
                                  : "transparent",
                                borderColor: selectedPhases.includes(phase.id)
                                  ? theme.palette.primary.main
                                  : "var(--audion-light-border-color, #0f172a)",
                                transition: "all 0.2s ease",
                                display: "flex",
                                alignItems: "center",
                                gap: 0.5
                              }}
                            >
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    size="small"
                                    sx={{
                                      py: 0.25,
                                      padding: "4px",
                                      "& .MuiSvgIcon-root": {
                                        width: "18px",
                                        height: "18px",
                                        borderRadius: "50%",
                                        border: "1.5px solid var(--audion-light-border-color, #0f172a)",
                                        transition: "all 0.2s ease"
                                      },
                                      "&:not(.Mui-checked) .MuiSvgIcon-root": {
                                        backgroundColor: "transparent",
                                        "& path": {
                                          display: "none"
                                        }
                                      },
                                      "&.Mui-checked .MuiSvgIcon-root": {
                                        borderColor: theme.palette.primary.main,
                                        backgroundColor: theme.palette.primary.main,
                                        "& path": {
                                          display: "block",
                                          fill: "#fff"
                                        }
                                      }
                                    }}
                                    checked={selectedPhases.includes(phase.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedPhases([...selectedPhases, phase.id]);
                                      } else {
                                        setSelectedPhases(selectedPhases.filter((id) => id !== phase.id));
                                      }
                                    }}
                                  />
                                }
                                label={
                                  <Box sx={{ flex: 1 }}>
                                    <Typography variant="caption" fontWeight={500} sx={{ fontSize: "0.75rem", display: "block", lineHeight: 1.3 }}>
                                      {phase.phase_order || 0}. {phase.name}
                                    </Typography>
                                    {phase.elements && phase.elements.length > 0 && (
                                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.6875rem", lineHeight: 1.2 }}>
                                        {phase.elements.length} Moment{phase.elements.length !== 1 ? "s" : ""}
                                      </Typography>
                                    )}
                                  </Box>
                                }
                                sx={{ m: 0, flex: 1 }}
                              />
                              {phase.description && (
                                <Tooltip
                                  title={
                                    <Box>
                                      <Typography variant="caption" sx={{ display: "block", fontWeight: 600, mb: 0.5 }}>
                                        {phase.name}
                                      </Typography>
                                      <Typography variant="caption" sx={{ display: "block", fontSize: "0.75rem" }}>
                                        {phase.description}
                                      </Typography>
                                    </Box>
                                  }
                                  arrow
                                  placement="left"
                                  componentsProps={{
                                    tooltip: {
                                      sx: {
                                        backgroundColor: "var(--color-neutral)",
                                        border: "1px solid var(--audion-light-border-color, #0f172a)",
                                        color: "var(--color-text-primary)",
                                        maxWidth: "300px"
                                      }
                                    },
                                    arrow: {
                                      sx: {
                                        color: "var(--color-neutral)",
                                        "&::before": {
                                          border: "1px solid var(--audion-light-border-color, #0f172a)"
                                        }
                                      }
                                    }
                                  }}
                                >
                                  <IconButton
                                    size="small"
                                    sx={{
                                      p: 0.5,
                                      minWidth: "auto",
                                      width: "24px",
                                      height: "24px",
                                      color: "text.secondary",
                                      "&:hover": {
                                        color: "text.primary"
                                      }
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MsqdxIcon name="info" customSize={16} />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Paper>
                          ))}
                      </Stack>
                    </Box>
                  )}

                  {selectedJourney && selectedJourney.phases.length === 0 && (
                    <Box sx={{ textAlign: "center", py: 1.5 }}>
                      <MsqdxIcon name="info" customSize={24} style={{ opacity: 0.5 }} />
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5, fontSize: "0.6875rem" }}>
                        No phases
                      </Typography>
                    </Box>
                  )}
                </Stack>
              )}
            </>
          )}

          {/* Tab: Variables */}
          {activeDialogTab === "variables" && (
            <Box sx={{ maxHeight: "400px", overflowY: "auto" }}>
              <VariablePalette
                onVariableClick={handleVariableClick}
              />
            </Box>
          )}

          {/* Tab: Attachments */}
          {activeDialogTab === "attachments" && (
            <Stack spacing={2}>
              <Box
                sx={{
                  border: "2px dashed var(--audion-light-border-color, #0f172a)",
                  borderRadius: "12px",
                  p: 3,
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  "&:hover": {
                    borderColor: theme.palette.primary.main,
                    backgroundColor: alpha(theme.palette.primary.main, 0.05)
                  }
                }}
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = "image/*";
                  input.multiple = true;
                  input.onchange = (e) => {
                    const target = e.target as HTMLInputElement;
                    handleImageUpload(target.files);
                  };
                  input.click();
                }}
              >
                <MsqdxIcon name="upload_file" customSize={32} style={{ opacity: 0.6, marginBottom: "0.5rem" }} />
                <Typography variant="caption" sx={{ display: "block", fontSize: "0.75rem", fontWeight: 500 }}>
                  Upload Images
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.6875rem" }}>
                  Click to select or drag and drop
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.625rem", mt: 0.5, display: "block" }}>
                  Figma links and URLs coming soon
                </Typography>
              </Box>

              {/* Uploaded Images Preview */}
              {attachedImages.length > 0 && (
                <Box>
                  <Typography variant="caption" sx={{ mb: 1, fontWeight: 600, display: "block", fontSize: "0.6875rem" }}>
                    Uploaded ({attachedImages.length}):
                  </Typography>
                  <Stack spacing={1}>
                    {attachedImages.map((imageDataUrl, index) => (
                      <Paper
                        key={index}
                        variant="outlined"
                        sx={{
                          p: 1,
                          display: "flex",
                          alignItems: "center",
                          gap: 1
                        }}
                      >
                        <Box
                          component="img"
                          src={imageDataUrl}
                          alt={`Preview ${index + 1}`}
                          sx={{
                            width: 40,
                            height: 40,
                            objectFit: "cover",
                            borderRadius: "4px"
                          }}
                        />
                        <Typography variant="caption" sx={{ flex: 1, fontSize: "0.75rem" }}>
                          Image {index + 1}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setAttachedImages((prev) => prev.filter((_, i) => i !== index));
                          }}
                          sx={{ p: 0.5 }}
                        >
                          <MsqdxIcon name="close" customSize={16} />
                        </IconButton>
                      </Paper>
                    ))}
                  </Stack>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, gap: 0.75 }}>
          <button
            type="button"
            className="msqdx-glass-button --ghost"
            onClick={() => {
              setJourneyDialogOpen(false);
              setSelectedJourneyId(null);
              setSelectedPhases([]);
              setSelectedJourney(null);
              setActiveDialogTab("phases");
              setAttachedImages([]);
            }}
          >
            Cancel
          </button>
          {activeDialogTab === "phases" && (
            <button
              type="button"
              className="msqdx-glass-button"
              onClick={handleAddPhasesToChat}
              disabled={selectedPhases.length === 0}
            >
              <MsqdxIcon name="add" customSize={14} />
              Add {selectedPhases.length}
            </button>
          )}
          {activeDialogTab === "attachments" && (
            <button
              type="button"
              className="msqdx-glass-button"
              onClick={handleAddAttachmentsToChat}
              disabled={attachedImages.length === 0}
            >
              <MsqdxIcon name="add" customSize={14} />
              Add {attachedImages.length} image{attachedImages.length !== 1 ? "s" : ""}
            </button>
          )}
        </DialogActions>
      </Dialog>

      {/* Share Chat Dialog */}
      <Dialog
        open={shareDialogOpen}
        onClose={() => {
          setShareDialogOpen(false);
          setShareLinkCopied(false);
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: "24px",
            backgroundColor: "var(--color-neutral)",
            border: "3px solid var(--audion-light-border-color, #0f172a)",
          },
        }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 0.75, pb: 1, pt: 2.5, px: 3 }}>
          <MsqdxIcon name="share" customSize={20} />
          <Typography variant="subtitle1" component="span" sx={{ fontWeight: 600 }}>
            Share Chat
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ px: 3, py: 2 }}>
          <Typography variant="body2" sx={{ mb: 2, color: alpha(theme.palette.text.primary, 0.8) }}>
            Share this link to let others open a chat with <strong>{personaDisplayName}</strong>. Recipients need to be logged in and have access to this project.
          </Typography>
          <TextField
            fullWidth
            size="small"
            value={
              activePersonaId && activeProjectId
                ? buildShareChatUrl({ personaId: activePersonaId, projectId: activeProjectId })
                : ""
            }
            InputProps={{
              readOnly: true,
              sx: { fontSize: "0.8125rem" },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 0.75 }}>
          <button
            type="button"
            className="msqdx-glass-button --ghost"
            onClick={() => {
              setShareDialogOpen(false);
              setShareLinkCopied(false);
            }}
          >
            Close
          </button>
          <button
            type="button"
            className="msqdx-glass-button"
            onClick={async () => {
              if (activePersonaId && activeProjectId) {
                const url = buildShareChatUrl({ personaId: activePersonaId, projectId: activeProjectId });
                try {
                  await navigator.clipboard.writeText(url);
                  setShareLinkCopied(true);
                  notify(t("adminChat.linkCopied"));
                  setTimeout(() => setShareLinkCopied(false), 2000);
                } catch {
                  notify(t("adminChat.copyFailed"));
                }
              }
            }}
            disabled={!activePersonaId || !activeProjectId}
          >
            <MsqdxIcon name="content_copy" customSize={16} />
            {shareLinkCopied ? t("adminChat.copied") : t("adminChat.copyLink")}
          </button>
        </DialogActions>
      </Dialog>

      {/* Persona Drawer */}
      <Drawer
        anchor="right"
        open={personaDrawerOpen}
        onClose={() => {
          // Remove focus from any button inside drawer before closing to prevent aria-hidden error
          const activeElement = document.activeElement as HTMLElement;
          if (activeElement && activeElement.closest('[role="presentation"]')) {
            activeElement.blur();
          }
          setPersonaDrawerOpen(false);
        }}
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
            backgroundColor: "var(--color-neutral)",
            color: theme.palette.text.primary
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
              src={safeAvatarSrc(activePersona?.image_url ?? null, activePersonaId ?? undefined) ?? undefined}
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
                  icon={<MsqdxIcon name={chip.icon} customSize={16} />}
                  label={chip.label}
                  size="small"
                  sx={{ borderRadius: 999 }}
                />
              ))}
            </Stack>
          </Stack>
          <Divider />
          <Stack spacing={2.5} sx={{ flex: 1, overflowY: "auto", pr: 0.5 }}>
            <MoodboardPersonaDrawerStrip
              moodboard={drawerMoodboard}
              moodboardError={drawerMoodboardError}
              locale={locale}
              t={t}
              hintVariant="admin"
            />
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
            {personaKeyFacts.length > 0 && (
              <Stack spacing={1}>
                <Typography variant="subtitle2" sx={{ textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: 1 }}>
                  Key facts
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
                  Goals
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
                  Frustrations
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
                  Interests
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
                  Values
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
          <Button
            variant="outlined"
            startIcon={<MsqdxIcon name="swap_horiz" customSize={16} />}
            onClick={(event) => setPersonaMenuAnchor(event.currentTarget)}
            sx={{
              borderRadius: 999
            }}
          >
            Change persona
          </Button>
        </Box>
      </Drawer>

      {/* Persona Menu */}
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
              <Typography variant="body2">{t("adminChat.loadingPersonas")}</Typography>
            </Stack>
          </MenuItem>
        ) : availablePersonas.length === 0 ? (
          <MenuItem disabled>{t("adminChat.noPersonasAvailable")}</MenuItem>
        ) : (
          availablePersonas.map((persona) => (
            <MenuItem
              key={persona.id}
              selected={persona.id === activePersonaId}
              onClick={() => {
                setActivePersonaId(persona.id);
                setPersonaMenuAnchor(null);
                ensureChatPromptForPersona(persona.id);
              }}
              sx={{ alignItems: "flex-start" }}
            >
              <Stack spacing={0.5}>
                <Typography variant="body1">{persona.name}</Typography>
                <Typography variant="caption">
                  {persona.segment} · {(persona.confidence * 100).toFixed(0)}% confidence
                </Typography>
              </Stack>
            </MenuItem>
          ))
        )}
      </Menu>
    </Box>
  );
}

function AdminChatLoadingFallback() {
  const { t } = useI18n();
  return <Typography>{t("adminChat.loading")}</Typography>;
}

export default function AdminChatPage() {
  return (
    <Suspense fallback={
      <Box sx={{ p: 3, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <AdminChatLoadingFallback />
      </Box>
    }>
      <AdminChatPageContent />
    </Suspense>
  );
}
