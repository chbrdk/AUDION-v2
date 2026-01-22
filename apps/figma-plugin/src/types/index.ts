export interface SelectionMetadata {
  nodeId: string;
  name: string;
  type: 'ARTBOARD' | 'GROUP' | 'FRAME';
  bounds: { x: number; y: number; width: number; height: number };
  layers: Array<{ id: string; name: string; type: string }>;
  figmaUrl: string;
}

export interface ConversationHistory {
  conversationId: string;
  personaId: string;
  selectionId: string; // nodeId
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    imageIds?: string[];
  }>;
  createdAt: number;
  updatedAt: number;
}

export interface Persona {
  id: string;
  name: string;
  segment: string;
  headline?: string;
  image_url?: string;
}

export interface TargetGroup {
  id: string;
  name: string;
  description?: string;
}

export interface PluginSettings {
  audionApiUrl: string;
  defaultPersonaId?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  imageIds?: string[];
}

export interface ChatRequest {
  persona_id: string;
  content: string;
  image_ids?: string[];
  conversation_id?: string;
  metadata?: {
    selection: SelectionMetadata;
    figma_file_id: string;
  };
  // Support for messages array format (for conversation history)
  messages?: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    image_ids?: string[];
  }>;
}

