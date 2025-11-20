export type ThinkingEvent = {
  type: 'thinking';
  status: string;
};

export type PersonasDiscoveredEvent = {
  type: 'personas_discovered';
  personas: Array<{
    persona_id?: string;
    name: string;
    segment: string;
    confidence: number;
  }>;
};

export type ContentDeltaEvent = {
  type: 'content_delta';
  delta: string;
  persona_id: string;
};

export type SourcesEvent = {
  type: 'sources';
  persona_id: string;
  sources: Array<{
    chunk_id: string;
    document_id: string;
    title: string;
    confidence: number;
    excerpt: string;
  }>;
};

export type CompleteEvent = {
  type: 'complete';
  persona_id: string;
  latency_ms: number;
};

export type PersonaSwitchEvent = {
  type: 'persona_switch';
  persona_id: string;
  name: string;
};

export type ChatEvent =
  | ThinkingEvent
  | PersonasDiscoveredEvent
  | ContentDeltaEvent
  | SourcesEvent
  | CompleteEvent
  | PersonaSwitchEvent;

