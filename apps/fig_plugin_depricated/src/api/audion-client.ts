import type { Persona, TargetGroup, ChatRequest, ChatMessage } from '../types';

// Base URL from central config
const DEFAULT_API_URL = 'https://192.168.50.101/audion/api';

let apiBaseUrl = DEFAULT_API_URL;
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
  const url = `${apiBaseUrl}/persona-backend/personas?page=${page}&page_size=${pageSize}`;
  return fetchWithErrorHandling<PersonaListResponse>(url);
}

export async function listTargetGroups(
  page: number = 1,
  pageSize: number = 100
): Promise<TargetGroupListResponse> {
  const url = `${apiBaseUrl}/persona-backend/target-groups?page=${page}&page_size=${pageSize}`;
  return fetchWithErrorHandling<TargetGroupListResponse>(url);
}

export async function sendMessage(
  request: ChatRequest
): Promise<ChatMessageResponse> {
  const url = `${apiBaseUrl}/chat/message`;
  return fetchWithErrorHandling<ChatMessageResponse>(url, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export interface WebSocketMessage {
  type: 'message' | 'persona_select';
  content?: string;
  persona_id?: string;
  image_ids?: string[];
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
    let url = `${wsUrl}/chat/ws/chat/${this.conversationId}`;
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
  const url = `${apiBaseUrl}/chat/images/upload`;
  
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

