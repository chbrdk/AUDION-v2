"use client";

import { useEffect, useMemo, useState, useRef, Suspense, type ReactNode } from "react";
import {
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
  Tooltip
} from "@mui/material";
import { UdgGlassChatPanel } from "../../../components/udg-glass-chat-panel";
import { MaterialSymbol } from "../../../components/material-symbol";
import { VariablePalette } from "../../../components/prompt-builder/VariablePalette";
import { type VariableDefinition } from "../../../components/prompt-builder/variableDefinitions";
import { getChatApiBase, getVoiceApiBase } from "../../api/_lib/backend";
import { useSpeechToText } from "../../../hooks/use-speech-to-text";
import { useWhisperTranscription } from "../../../hooks/use-whisper-transcription";
import { useAudioQueue } from "../../../hooks/use-audio-queue";
import { useAdminHeader } from "../../../components/admin/udg-glass-admin-layout";
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
  images?: string[]; // Base64 data URLs for images
};

function AdminChatPageContent() {
  const theme = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setHeaderContent } = useAdminHeader();
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
  const [attachedImages, setAttachedImages] = useState<string[]>([]); // Base64 data URLs
  const [pendingImages, setPendingImages] = useState<string[]>([]); // Bilder, die mit der nächsten Nachricht gesendet werden sollen
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

  useEffect(() => {
    const loadPersonas = async () => {
      try {
        setLoadingPersonas(true);
        const response = await fetch("/api/personas");
        if (response.ok) {
          const data = await response.json();
          const personas = Array.isArray(data) ? data : (data.items || []);
          setAvailablePersonas(
            personas.map((p: any) => {
              // Pydantic serializes PersonaPrompt with systemPrompt (camelCase) in JSON
              const systemPrompt = p.prompt?.systemPrompt ?? p.prompt?.system_prompt ?? null;
              // Debug: Log if prompt is found
              if (p.name?.toLowerCase().includes("clara")) {
                console.log("[Chat] Clara persona loaded:", {
                  id: p.id,
                  name: p.name,
                  hasPrompt: !!p.prompt,
                  promptKeys: p.prompt ? Object.keys(p.prompt) : [],
                  systemPrompt: systemPrompt ? systemPrompt.substring(0, 200) + "..." : null,
                  fullPrompt: systemPrompt,
                });
              }
              return {
                id: p.id,
                name: p.name,
                segment: p.segment,
                headline: p.headline,
                confidence: p.confidence ?? 1.0,
                image_url: p.image_url,
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

  const sendDisabled = !activePersonaId || sending || input.trim().length === 0;

  const handleSend = async (messageText?: string) => {
    const rawContent = (messageText?.trim() || input.trim());
    
    if (!activePersonaId || sending || !rawContent) {
      return;
    }
    
    if (speechListening) {
      stopListening();
      speechSessionActiveRef.current = false;
    }
    stopAudioQueue();
    
    // Ersetze Variablen in der User-Nachricht BEVOR sie gesendet wird
    const contentToSend = replaceMessageVariables(rawContent);
    
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
    // Type allows images for user messages
    const apiMessages: Array<{ role: string; content: string; images?: string[] }> = [];
    
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
          // Preserve images from conversation history if they exist
          images: msg.images,
        });
      });
    
    // Add current user message with images if available
    const userMessage: { role: string; content: string; images?: string[] } = {
      role: "user",
      content: contentToSend,
    };
    
    // Füge Bilder hinzu, wenn vorhanden
    console.log("[Chat] handleSend: pendingImages.length =", pendingImages.length);
    if (pendingImages.length > 0) {
      userMessage.images = [...pendingImages];
      console.log("[Chat] Sending message with images:", {
        imageCount: pendingImages.length,
        firstImagePreview: pendingImages[0].substring(0, 100) + "...",
        messageContent: contentToSend
      });
    } else {
      console.log("[Chat] handleSend: No images in pendingImages");
    }
    
    apiMessages.push(userMessage);
    
    // Debug: Log final API messages
    console.log("[Chat] API Messages being sent:", {
      totalMessages: apiMessages.length,
      lastMessage: {
        role: userMessage.role,
        hasImages: !!userMessage.images,
        imageCount: userMessage.images?.length || 0,
        contentLength: userMessage.content.length
      }
    });
    
    const messageId = `user-${Date.now()}`;
    const personaMessageId = `persona-${Date.now()}`;
    const voiceStreaming = voiceEnabled;
    
    setMessages((prev) => [
      ...prev,
      {
        id: messageId,
        role: "user",
        content: contentToSend,
        images: pendingImages.length > 0 ? [...pendingImages] : undefined
      }
    ]);
    setInput("");
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
      const requestBody = {
        persona_id: activePersonaId,
        messages: apiMessages,
      };
      
      // Debug: Log request body (truncate images for logging)
      const logBody = {
        ...requestBody,
        messages: requestBody.messages.map((msg: any) => ({
          ...msg,
          images: msg.images ? `[${msg.images.length} images, first: ${msg.images[0]?.substring(0, 50)}...]` : undefined
        }))
      };
      console.log("[Chat] Request body being sent:", logBody);
      
      // Debug: Check if images are in the actual JSON string
      const jsonString = JSON.stringify(requestBody);
      const hasImagesInJson = jsonString.includes('"images"');
      const imageCountInJson = (jsonString.match(/"images"/g) || []).length;
      console.log("[Chat] JSON string check:", {
        hasImagesInJson,
        imageCountInJson,
        jsonLength: jsonString.length,
        lastMessageHasImages: requestBody.messages[requestBody.messages.length - 1]?.images ? requestBody.messages[requestBody.messages.length - 1].images.length : 0
      });
      
      const response = await fetch(`${apiBase}${endpointPath}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: jsonString,
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
          buffer = lines.pop() || "";
          
          for (const line of lines) {
            if (!line.trim()) continue;
            
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (!streamStarted) {
                  streamStarted = true;
                  setSending(false);
                }
                
                if (data.type === "delta") {
                  if (data.delta) {
                    enqueueDelta(personaMessageId, data.delta);
                  }
                  if (voiceStreaming && data.audio) {
                    enqueueAudioChunk(data.audio, data.mime_type ?? "audio/mpeg");
                  }
                } else if (data.type === "sources") {
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
              }
            } else if (line.trim()) {
              console.error("Unexpected SSE line format:", line);
            }
          }
        }
      } catch (streamError) {
        console.error("Stream reading error:", streamError);
        throw streamError;
      } finally {
        reader.releaseLock();
        setSending(false);
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

  useEffect(() => {
    handleSendRef.current = handleSend;
  }, [handleSend]);

  // Load journeys when dialog opens
  useEffect(() => {
    if (journeyDialogOpen && journeys.length === 0) {
      loadJourneys();
    }
  }, [journeyDialogOpen]);

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
      const data = await journeysApi.listJourneys();
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

  const compressImage = (file: File, maxWidth: number = 1920, maxHeight: number = 1920, quality: number = 0.8): Promise<string> => {
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
                  console.log(`[Chat] Image compressed: ${file.size} -> ${blob.size} bytes (${Math.round((1 - blob.size / file.size) * 100)}% reduction)`);
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
      console.log("[Chat] handleImageUpload: No files provided");
      return;
    }
    
    console.log("[Chat] handleImageUpload: Files received", files.length);
    
    // Filtere nur Bilder
    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    console.log("[Chat] handleImageUpload: Image files filtered", imageFiles.length, imageFiles.map(f => ({ name: f.name, type: f.type, size: f.size })));
    
    // Komprimiere und konvertiere Bilder zu Base64 data URLs
    try {
      const base64Images = await Promise.all(
        imageFiles.map(file => compressImage(file))
      );
      console.log("[Chat] handleImageUpload: Images compressed and converted to base64", base64Images.length, "First image preview:", base64Images[0]?.substring(0, 100) + "...");
      setAttachedImages((prev) => {
        const newImages = [...prev, ...base64Images];
        console.log("[Chat] handleImageUpload: attachedImages updated", newImages.length);
        return newImages;
      });
    } catch (error) {
      console.error('[Chat] Failed to compress/convert images:', error);
    }
  };

  const handleAddAttachmentsToChat = () => {
    console.log("[Chat] handleAddAttachmentsToChat: called, attachedImages.length =", attachedImages.length);
    
    if (attachedImages.length === 0) {
      console.log("[Chat] handleAddAttachmentsToChat: No images to add, returning");
      return;
    }

    // Speichere Bilder für die nächste Nachricht
    setPendingImages((prev) => {
      const newPending = [...prev, ...attachedImages];
      console.log("[Chat] handleAddAttachmentsToChat: pendingImages updated", newPending.length, "images");
      return newPending;
    });
    
    // Schließe Dialog und setze zurück
    setJourneyDialogOpen(false);
    setAttachedImages([]);
    setActiveDialogTab("phases");
    
    // Optional: Fokussiere den Input, damit User direkt tippen kann
    setTimeout(() => {
      const inputElement = document.querySelector('input[placeholder*="Ask"], textarea[placeholder*="Ask"]') as HTMLInputElement | HTMLTextAreaElement;
      inputElement?.focus();
    }, 100);
  };

  // Load conversation from URL on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const conversationIdParam = searchParams.get("conversationId");
    if (conversationIdParam) {
      const conversation = loadConversationFromLocalStorage(conversationIdParam);
      if (conversation) {
        setCurrentConversationId(conversation.metadata.conversationId);
        setConversationTitle(conversation.metadata.title);
        setMessages(conversation.messages);
        setActivePersonaId(conversation.metadata.personaId);
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
    }
  }, [searchParams]);

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

    // Build the system prompt with current context
    // Debug: Log persona data for troubleshooting
    if (activePersona.name?.toLowerCase().includes("clara")) {
      console.log("[Chat] Persona data for variable replacement:", {
        name: activePersona.name,
        headline: activePersona.headline,
        profileHeadline: activePersona.profile?.headline,
        profileCardHeadline: activePersona.profileCard?.headline,
        bio: activePersona.profile?.bio?.substring(0, 100),
      });
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

  // Update header with persona info when activePersona changes
  useEffect(() => {
    // Only run on client side
    if (typeof window === "undefined") return;
    
    if (activePersonaId && activePersona) {
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
            src={activePersona.image_url ?? undefined}
            alt={activePersona.name}
            sx={{ width: 36, height: 36 }}
          >
            {activePersona.name.charAt(0)}
          </Avatar>
          <Box textAlign="left">
            <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1 }}>
              {personaDisplayName}
            </Typography>
            <Typography variant="caption" sx={{ color: alpha(theme.palette.text.primary, 0.7) }}>
              View persona profile
            </Typography>
          </Box>
          <MaterialSymbol icon="chevron_right" fontSize={20} />
        </Button>
      );
    } else {
      setHeaderContent(null);
    }

    // Cleanup: reset header when component unmounts
    return () => {
      setHeaderContent(null);
    };
  }, [activePersonaId, activePersona, personaDisplayName, setHeaderContent, theme]);

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
        {/* Persona Selection - wenn keine Persona ausgewählt */}
        {!activePersonaId && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
              minHeight: 0
            }}
          >
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
                Choose a persona to start
              </Typography>
              <Typography variant="body2">
                Pick the audience voice you'd like to talk to.
              </Typography>
              <Button
                variant="contained"
                size="large"
                startIcon={<MaterialSymbol icon="person_add" fontSize={22} />}
                onClick={(event) => setPersonaMenuAnchor(event.currentTarget)}
                disabled={loadingPersonas}
                sx={{
                  borderRadius: 999,
                  px: 4
                }}
              >
                {loadingPersonas ? "Loading personas…" : "Choose persona"}
              </Button>
              {loadingPersonas && <CircularProgress size={28} />}
            </Stack>
          </Box>
        )}

        {/* Chat Interface - wenn Persona ausgewählt */}
        {activePersonaId && (
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
            {(thinkingLabel || sending) && (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  padding: "0.5rem 1rem",
                  flexShrink: 0
                }}
              >
                {thinkingLabel && (
                  <Typography variant="body2" sx={{ color: alpha(theme.palette.text.primary, 0.7) }}>
                    {thinkingLabel}
                  </Typography>
                )}
                {sending && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={16} />
                    <Typography variant="body2">Sending…</Typography>
                  </Stack>
                )}
              </Box>
            )}

            {/* Chat Messages - Scrollable Area */}
            <Box 
              sx={{ 
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                padding: "1rem",
                marginBottom: "1rem"
              }}
            >
              <UdgGlassChatPanel messages={messages} systemPrompt={currentSystemPrompt} />
            </Box>

            {/* Input Area - Fixed at Bottom */}
            <Box
              component="form"
              onSubmit={(event) => {
                event.preventDefault();
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
                zIndex: 10
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  gap: 1,
                  alignItems: "center",
                  maxWidth: "720px",
                  mx: "auto"
                }}
              >
                <Tooltip title="Journey-Phasen hinzufügen">
                  <IconButton
                    onClick={() => setJourneyDialogOpen(true)}
                    disabled={!activePersonaId || sending}
                    sx={{
                      backgroundColor: alpha(theme.palette.text.primary, 0.08),
                      borderRadius: 999
                    }}
                  >
                    <MaterialSymbol icon="add" fontSize={22} />
                  </IconButton>
                </Tooltip>
                <Tooltip title={whisperRecording ? "Stop recording" : "Start voice input"}>
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
                    <MaterialSymbol icon="keyboard_voice" fontSize={22} />
                  </IconButton>
                </Tooltip>
                <TextField
                  fullWidth
                  variant="outlined"
                  placeholder="Ask the persona anything…"
                  value={input}
                  disabled={!activePersonaId || sending}
                  onChange={(event) => setInput(event.target.value)}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 999
                    }
                  }}
                />
                <Tooltip title="Toggle persona playback">
                  <IconButton
                    onClick={handleVoiceToggle}
                    sx={{
                      backgroundColor: voiceEnabled ? "var(--color-secondary-dx-green)" : alpha(theme.palette.text.primary, 0.08),
                      borderRadius: 999
                    }}
                  >
                    <MaterialSymbol icon="headphones" fontSize={22} />
                  </IconButton>
                </Tooltip>
                <IconButton
                  onClick={() => void handleSend()}
                  disabled={sendDisabled}
                  sx={{
                    backgroundColor: sendDisabled
                      ? alpha(theme.palette.text.primary, 0.2)
                      : "var(--color-secondary-dx-green)",
                    color: "#ffffff",
                    borderRadius: 999
                  }}
                >
                  <MaterialSymbol icon="send" fontSize={22} />
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

        {/* Evidence Section - Outside of chat interface container */}
        {activePersonaId && latestSources && latestSources.length > 0 && (
          <Box sx={{ mt: 2, maxWidth: "720px", mx: "auto", width: "100%" }}>
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
            <MaterialSymbol icon="add_circle" fontSize={16} />
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
                label="Journey Phases"
                icon={<MaterialSymbol icon="route" fontSize={14} />}
                iconPosition="start"
              />
              <Tab
                value="variables"
                label="Variables"
                icon={<MaterialSymbol icon="code" fontSize={14} />}
                iconPosition="start"
              />
              <Tab
                value="attachments"
                label="Attachments"
                icon={<MaterialSymbol icon="image" fontSize={14} />}
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
                      <InputLabel sx={{ fontSize: "0.75rem" }}>Journey</InputLabel>
                      <Select
                        value={selectedJourneyId || ""}
                        onChange={(e) => setSelectedJourneyId(e.target.value || null)}
                        label="Journey"
                        sx={{ fontSize: "0.8125rem", "& .MuiSelect-select": { py: 0.75 } }}
                      >
                        {journeys.length === 0 ? (
                          <MenuItem disabled sx={{ fontSize: "0.75rem" }}>None available</MenuItem>
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
                                      <MaterialSymbol icon="info" fontSize={16} />
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
                        <MaterialSymbol icon="info" fontSize={24} style={{ opacity: 0.5 }} />
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
                  <MaterialSymbol icon="upload_file" fontSize={32} style={{ opacity: 0.6, marginBottom: "0.5rem" }} />
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
                            <MaterialSymbol icon="close" fontSize={16} />
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
              className="udg-glass-button --ghost"
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
                className="udg-glass-button"
                onClick={handleAddPhasesToChat}
                disabled={selectedPhases.length === 0}
              >
                <MaterialSymbol icon="add" fontSize={14} />
                Add {selectedPhases.length}
              </button>
            )}
            {activeDialogTab === "attachments" && (
              <button
                type="button"
                className="udg-glass-button"
                onClick={handleAddAttachmentsToChat}
                disabled={attachedImages.length === 0}
              >
                <MaterialSymbol icon="add" fontSize={14} />
                Add {attachedImages.length} image{attachedImages.length !== 1 ? "s" : ""}
              </button>
            )}
          </DialogActions>
        </Dialog>

        {/* Persona Drawer */}
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
              backgroundColor: "var(--color-neutral)",
              color: theme.palette.text.primary
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
                        icon={<MaterialSymbol icon="star" fontSize={14} />}
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
                        icon={<MaterialSymbol icon="check" fontSize={14} />}
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
                        icon={<MaterialSymbol icon="warning" fontSize={14} />}
                        sx={{ borderRadius: 999 }}
                      />
                    ))}
                  </Stack>
                </Stack>
              )}
            </Stack>
            <Button
              variant="outlined"
              startIcon={<MaterialSymbol icon="swap_horiz" fontSize={16} />}
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

export default function AdminChatPage() {
  return (
    <Suspense fallback={
      <Box sx={{ p: 3, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Typography>Loading...</Typography>
      </Box>
    }>
      <AdminChatPageContent />
    </Suspense>
  );
}

