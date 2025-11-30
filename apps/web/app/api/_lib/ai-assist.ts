import { getPersonaBackendBase } from "./backend";

export type AiProvider = "anthropic" | "openai";

export interface AiAssistSuggestion {
  content: string;
  title?: string;
  type?: string;
  metadata?: Record<string, unknown>;
}

export interface AiAssistResponse {
  template_id: string;
  provider: AiProvider;
  model: string;
  suggestions: AiAssistSuggestion[];
  raw_output: string;
  usage?: Record<string, unknown>;
}

export interface AiAssistRequest {
  template_id: string;
  provider?: AiProvider;
  model?: string;
  context?: Record<string, unknown>;
  prompt_variables?: Record<string, unknown>;
  max_suggestions?: number;
}

export interface AiTemplateSummary {
  template_id: string;
  label: string;
  description: string;
  category: string;
  tags: string[];
  default_provider: AiProvider;
  default_model?: string;
}

export interface AiTemplateOutputConfig {
  mode: "json" | "text";
  key?: string;
  item_fields?: Record<string, string>;
}

export interface AiTemplateDefinition {
  template_id: string;
  label: string;
  description: string;
  category: string;
  tags: string[];
  default_provider: AiProvider;
  default_model?: string;
  temperature: number;
  max_tokens: number;
  prompt: string;
  output: AiTemplateOutputConfig;
  metadata?: Record<string, unknown>;
}

export interface AiTemplateUpdateRequest {
  label?: string;
  description?: string;
  category?: string;
  tags?: string[];
  default_provider?: AiProvider;
  default_model?: string;
  temperature?: number;
  max_tokens?: number;
  prompt?: string;
  output?: AiTemplateOutputConfig;
  metadata?: Record<string, unknown>;
}

export interface AiPromptTestRequest {
  prompt: string;
  provider?: AiProvider;
  model?: string;
  context?: Record<string, unknown>;
  temperature?: number;
  max_tokens?: number;
}

export const aiAssistApi = {
  listTemplates: async (): Promise<AiTemplateSummary[]> => {
    const response = await fetch(`${getPersonaBackendBase()}/ai-assist/templates`);
    if (!response.ok) {
      const error = await response.text().catch(() => "");
      throw new Error(error || `Backend responded with ${response.status}`);
    }
    return response.json();
  },

  getTemplate: async (templateId: string): Promise<AiTemplateDefinition> => {
    const response = await fetch(`${getPersonaBackendBase()}/settings/ai/templates/${templateId}`);
    if (!response.ok) {
      const error = await response.text().catch(() => "");
      throw new Error(error || `Backend responded with ${response.status}`);
    }
    return response.json();
  },

  updateTemplate: async (templateId: string, payload: AiTemplateUpdateRequest): Promise<AiTemplateDefinition> => {
    const response = await fetch(`${getPersonaBackendBase()}/settings/ai/templates/${templateId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const error = await response.text().catch(() => "");
      throw new Error(error || `Backend responded with ${response.status}`);
    }
    return response.json();
  },

  execute: async (payload: AiAssistRequest): Promise<AiAssistResponse> => {
    const response = await fetch(`${getPersonaBackendBase()}/ai-assist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const error = await response.text().catch(() => "");
      throw new Error(error || `Backend responded with ${response.status}`);
    }
    return response.json();
  },

  testPrompt: async (payload: AiPromptTestRequest): Promise<AiAssistResponse> => {
    const response = await fetch(`${getPersonaBackendBase()}/ai-assist/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const error = await response.text().catch(() => "");
      throw new Error(error || `Backend responded with ${response.status}`);
    }
    return response.json();
  },
};

