export interface SelectionMetadata {
  nodeId: string;
  name: string;
  type: 'ARTBOARD' | 'GROUP' | 'FRAME';
  bounds: { x: number; y: number; width: number; height: number };
  layers: Array<{ id: string; name: string; type: string }>;
  visualStyles?: any;
  figmaUrl: string;
  fileId: string;
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

export interface Project {
  id: string;
  name: string;
  description?: string;
  organization_id: string;
}

export interface PluginSettings {
  audionApiUrl: string;
  /** Optional: RAG/Compose API URL for RAGDesign (Library-First). Defaults to audionApiUrl. */
  ragApiUrl?: string;
  /** Optional: enable html-to-figma image debug flow (`?debugImages=1`). */
  htmlToFigmaImageDebug?: boolean;
  /**
   * CREATION `PLUGIN_API_SECRET` — required for Prompt→Site→Figma (`POST /api/v1/generate-site-to-layers`).
   * Never commit real values; store only in Figma client storage.
   */
  creationPluginApiSecret?: string;
  /** Optional: Opal or other discovery URL to resolve tools/APIs for direct access. */
  opalDiscoveryUrl?: string;
  defaultPersonaId?: string;
  projectId?: string;
  authToken?: string;
  brandColor?: string;
  language?: 'de' | 'en';
  openAiApiKey?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  imageIds?: string[];
}

export interface ChatRequest {
  persona_id: string;
  message?: string;
  messages?: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    image_ids?: string[];
  }>;
  user_id?: string;
  // Extra fields that could be ignored by backend, but we keep them optional
  conversation_id?: string;
  metadata?: {
    selection: SelectionMetadata;
    figma_file_id: string;
  };
}

export interface JourneyResponse {
  id: string;
  name: string;
  description?: string;
  journey_type: string;
  status: string;
  phases: PhaseResponse[];
}

export interface PhaseResponse {
  id: string;
  name: string;
  description?: string;
  phase_order: number;
  elements: ElementResponse[];
}

export interface ElementResponse {
  id: string;
  element_type: string;
  content: string;
  element_order: number;
  metadata?: Record<string, any>;
}

export interface ExpectationResponse {
  id: string;
  metric_name: string;
  expected_value?: number;
}

export interface ScannedComponent {
  id: string; // The Figma key or ID
  name: string;
  description: string;
  documentation: string; // LLM-friendly description of variants and props
  visualBlueprint?: string; // Deep analysis of internal structure and styles
  variants: Record<string, string[]>;
  properties: Array<{ name: string; type: string; defaultValue?: string }>;
  // AI Enriched Metadata
  tags?: string[];
  styleCategory?: string; // e.g. "Glassmorphism", "Flat", "Material"
  usageNotes?: string;
}

export interface ScannedPageSection {
  name: string;
  componentIds?: string[];
  childNames?: string[];
}

export interface ScannedPage {
  id: string;
  name: string;
  description?: string;
  pageType?: 'landing' | 'dashboard' | 'article' | 'generic';
  structure: ScannedPageSection[];
  componentRefs: string[];
  blueprintSummary: string;
}

export interface ComponentKnowledgeBase {
  components: ScannedComponent[];
  pages: ScannedPage[];
  lastUpdated: number;
}

export type ViewportType = 'desktop' | 'mobile' | 'both';
export type AIModelType = 'gpt-5-mini' | 'gpt-4o-mini' | 'gpt-4o';
