import type { Persona, TargetGroup, ChatRequest, ChatMessage, JourneyResponse, Project } from '../types';
import { URL_CONFIG } from '../config/urls';

type SseSourcePayload = {
  chunk_id?: string;
  document_id?: string;
  title?: string;
  confidence?: number;
  content?: string;
  excerpt?: string;
};

/**
 * Reads a chat-api SSE response until the connection closes; returns the same shape as the legacy JSON endpoint.
 */
async function readChatMessageStream(
  response: Response,
  personaId: string
): Promise<ChatMessageResponse> {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error: ${response.status} - ${errorText}`);
  }
  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let rawBuffer = '';
  let fullText = '';
  let latestSources: ChatMessageResponse['sources'] = [];
  let streamError: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    rawBuffer += decoder.decode(value, { stream: true });
    const events = rawBuffer.split('\n\n');
    rawBuffer = events.pop() ?? '';

    for (const block of events) {
      if (!block.trim() || !block.startsWith('data: ')) continue;
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(block.slice(6)) as Record<string, unknown>;
      } catch {
        continue;
      }
      const ev = parsed.type;
      if (ev === 'delta' && typeof parsed.delta === 'string') {
        fullText += parsed.delta;
      } else if (ev === 'sources' && Array.isArray(parsed.sources)) {
        latestSources = (parsed.sources as SseSourcePayload[]).map((s, i) => ({
          chunk_id: s.chunk_id ?? `chunk-${i}`,
          document_id: s.document_id ?? 'Unknown',
          content: (s.excerpt ?? s.content ?? '') as string,
          confidence: typeof s.confidence === 'number' ? s.confidence : 0.8,
        }));
      } else if (ev === 'error') {
        streamError =
          typeof parsed.error === 'string' ? parsed.error : 'Stream error';
      }
    }
  }

  if (streamError) {
    throw new Error(streamError);
  }

  return {
    response: fullText,
    sources: latestSources,
    persona_id: personaId,
  };
}

const DEFAULT_API_URL: string = URL_CONFIG.AUDION_API_BASE;

let apiBaseUrl: string = DEFAULT_API_URL;
let currentAuthToken: string | undefined;

export function setApiBaseUrl(url: string): void {
  apiBaseUrl = url;
}

export function setAuthToken(token?: string): void {
  currentAuthToken = token;
}

export function getApiBaseUrl(): string {
  return apiBaseUrl;
}

export interface PersonaListResponse {
  items: Persona[];
  total: number;
  page: number;
  page_size: number;
}

export interface TargetGroupListResponse {
  items: TargetGroup[];
  total: number;
  page: number;
  page_size: number;
}

export interface ChatMessageResponse {
  response: string;
  sources: Array<{
    chunk_id: string;
    document_id: string;
    content: string;
    confidence: number;
  }>;
  persona_id: string;
}

async function fetchWithErrorHandling<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options?.headers as Record<string, string>) || {}),
    };

    if (currentAuthToken) {
      headers['Authorization'] = `Bearer ${currentAuthToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Network error: ${String(error)}`);
  }
}

export async function listPersonas(
  page: number = 1,
  pageSize: number = 100
): Promise<PersonaListResponse> {
  const url = `${apiBaseUrl}/api/personas?page=${page}&page_size=${pageSize}`;
  return fetchWithErrorHandling<PersonaListResponse>(url);
}

export async function listTargetGroups(
  page: number = 1,
  pageSize: number = 100
): Promise<TargetGroupListResponse> {
  const url = `${apiBaseUrl}/api/target-groups?page=${page}&page_size=${pageSize}`;
  return fetchWithErrorHandling<TargetGroupListResponse>(url);
}

export async function listProjects(
  page: number = 1,
  pageSize: number = 100
): Promise<Project[]> {
  const url = `${apiBaseUrl}/api/projects?page=${page}&page_size=${pageSize}`;
  return fetchWithErrorHandling<Project[]>(url);
}

export async function listJourneys(
  projectId?: string,
  page: number = 1,
  pageSize: number = 100
): Promise<JourneyResponse[]> {
  let url = `${apiBaseUrl}/api/journeys?page=${page}&page_size=${pageSize}`;
  if (projectId) {
    url += `&project_id=${projectId}`;
  }
  return fetchWithErrorHandling<JourneyResponse[]>(url);
}

export async function getJourney(id: string): Promise<JourneyResponse> {
  const url = `${apiBaseUrl}/api/journeys/${id}`;
  return fetchWithErrorHandling<JourneyResponse>(url);
}

export async function sendMessage(
  request: ChatRequest
): Promise<ChatMessageResponse> {
  const url = `${apiBaseUrl}${URL_CONFIG.AUDION_CHAT_MESSAGE_STREAM_PATH}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (currentAuthToken) {
    headers['Authorization'] = `Bearer ${currentAuthToken}`;
  }
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });
  return readChatMessageStream(response, request.persona_id);
}

export interface WebSocketMessage {
  type: 'message' | 'persona_select';
  /** Latest user text when not using `messages` (chat-api ws/chat). */
  content?: string;
  persona_id?: string;
  image_ids?: string[];
  user_id?: string;
  /**
   * Optional conversation history for turn naturalness (Du/Sie, last user for retrieval).
   * When set, last user message is used as the main query; previous user turns inform style.
   */
  messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface WebSocketEvent {
  type: string;
  [key: string]: unknown;
}

export class AudionWebSocket {
  private ws: WebSocket | null = null;
  private conversationId: string;
  private onMessage: (event: WebSocketEvent) => void;
  private onError: (error: Error) => void;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;

  constructor(
    conversationId: string,
    onMessage: (event: WebSocketEvent) => void,
    onError: (error: Error) => void
  ) {
    this.conversationId = conversationId;
    this.onMessage = onMessage;
    this.onError = onError;
  }

  connect(): void {
    const wsUrl = apiBaseUrl.replace('https://', 'wss://').replace('http://', 'ws://');
    let url = `${wsUrl}/api/chat/ws/chat/${this.conversationId}`;
    if (currentAuthToken) {
      url += `?token=${currentAuthToken}`;
    }

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        console.log('WebSocket connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WebSocketEvent;
          this.onMessage(data);
        } catch (error) {
          this.onError(new Error(`Failed to parse WebSocket message: ${error}`));
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.onError(new Error('WebSocket connection error'));
      };

      this.ws.onclose = () => {
        console.log('WebSocket closed');
        // Attempt to reconnect if not intentional
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          setTimeout(() => this.connect(), 1000 * this.reconnectAttempts);
        }
      };
    } catch (error) {
      this.onError(new Error(`Failed to create WebSocket: ${error}`));
    }
  }

  send(message: WebSocketMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.onError(new Error('WebSocket is not connected'));
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export interface ImageUploadResponse {
  image_id: string;
}

export async function uploadImage(imageBase64: string): Promise<string> {
  // Upload image to /images/upload endpoint
  const url = `${apiBaseUrl}/api/chat/images/upload`;
  
  try {
    const response = await fetchWithErrorHandling<ImageUploadResponse>(url, {
      method: 'POST',
      body: JSON.stringify({
        image: imageBase64, // Base64 data URL
      }),
    });
    
    return response.image_id;
  } catch (error) {
    console.error('Failed to upload image:', error);
    // Fallback: return base64 directly (API might accept it)
    throw error;
  }
}

