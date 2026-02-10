import { buildApiUrl } from "./backend";

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

const buildAiAssistUrl = (path: string, params?: URLSearchParams) => {
  const normalized = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  const base = buildApiUrl(`/api/ai-assist${normalized}`);
  const query = params?.toString();
  return query ? `${base}?${query}` : base;
};

const buildSettingsUrl = (path: string, params?: URLSearchParams) => {
  const normalized = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  const base = buildApiUrl(`/api/settings${normalized}`);
  const query = params?.toString();
  return query ? `${base}?${query}` : base;
};

export const aiAssistApi = {
  listTemplates: async (projectId?: string): Promise<AiTemplateSummary[]> => {
    const params = new URLSearchParams();
    if (projectId) params.set("project_id", projectId);
    // Use settings proxy (same as getTemplate/updateTemplate) for consistent routing
    const response = await fetch(buildSettingsUrl("/ai/templates", params), { cache: "no-store" });
    if (response.status === 404) {
      // Endpoint not found or no route – return empty list so UI doesn't break
      return [];
    }
    if (!response.ok) {
      const error = await response.text().catch(() => "");
      throw new Error(error || `Backend responded with ${response.status}`);
    }
    return response.json();
  },

  getTemplate: async (templateId: string, projectId?: string): Promise<AiTemplateDefinition> => {
    const params = new URLSearchParams();
    if (projectId) params.set("project_id", projectId);
    const response = await fetch(buildSettingsUrl(`/ai/templates/${templateId}`, params), { cache: "no-store" });
    if (!response.ok) {
      const error = await response.text().catch(() => "");
      throw new Error(error || `Backend responded with ${response.status}`);
    }
    return response.json();
  },

  updateTemplate: async (
    templateId: string,
    payload: AiTemplateUpdateRequest,
    projectId?: string
  ): Promise<AiTemplateDefinition> => {
    const params = new URLSearchParams();
    if (projectId) params.set("project_id", projectId);
    const response = await fetch(buildSettingsUrl(`/ai/templates/${templateId}`, params), {
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

  execute: async (payload: AiAssistRequest, projectId?: string): Promise<AiAssistResponse> => {
    const params = new URLSearchParams();
    if (projectId) params.set("project_id", projectId);
    const response = await fetch(buildAiAssistUrl("", params), {
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
    const response = await fetch(buildAiAssistUrl("/test"), {
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

  // Persona Prompts
  listPersonaPrompts: async (): Promise<AiTemplateSummary[]> => {
    const response = await fetch(buildSettingsUrl("/ai/persona-prompts"), { cache: "no-store" });
    if (response.status === 404) {
      // Endpoint not found or no route – return empty list so UI doesn't break
      return [];
    }
    if (!response.ok) {
      const error = await response.text().catch(() => "");
      throw new Error(error || `Backend responded with ${response.status}`);
    }
    return response.json();
  },

  getPersonaPrompt: async (personaId: string): Promise<AiTemplateDefinition> => {
    const response = await fetch(buildSettingsUrl(`/ai/persona-prompts/${personaId}`), { cache: "no-store" });
    if (!response.ok) {
      const error = await response.text().catch(() => "");
      throw new Error(error || `Backend responded with ${response.status}`);
    }
    return response.json();
  },

  updatePersonaPrompt: async (personaId: string, payload: AiTemplateUpdateRequest): Promise<AiTemplateDefinition> => {
    const response = await fetch(buildSettingsUrl(`/ai/persona-prompts/${personaId}`), {
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
};
