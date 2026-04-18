import { buildApiUrl } from "./backend";

// Types (should match backend schemas)
export interface JourneyCreate {
  name: string;
  description?: string;
  journey_type: string;
  creation_mode: "manual" | "ai_generated" | "hybrid";
  target_group_id?: string;
  project_id?: string;
  organization_id: string;
  created_by?: string;
}

export interface JourneyResponse {
  id: string;
  organization_id: string;
  project_id?: string;
  target_group_id?: string;
  name: string;
  description?: string;
  journey_type: string;
  creation_mode: "manual" | "ai_generated" | "hybrid";
  status: string;
  validation_score?: number;
  tracking_enabled: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
  phases: PhaseResponse[];
}

export interface PhaseCreate {
  name: string;
  description?: string;
  phase_order: number;
  expected_duration_min?: number;
  expected_duration_max?: number;
  duration_unit?: string;
  expected_emotion?: string;
  emotion_intensity?: number;
  url_pattern?: Record<string, any>;
  form_id?: Record<string, any>;
  event_names?: Record<string, any>;
}

export interface PhaseResponse {
  id: string;
  journey_id: string;
  name: string;
  description?: string;
  phase_order: number;
  expected_duration_min?: number;
  expected_duration_max?: number;
  duration_unit?: string;
  expected_emotion?: string;
  emotion_intensity?: number;
  validation_score?: number;
  validation_status?: string;
  generated_by_ai: boolean;
  generation_confidence?: number;
  elements: ElementResponse[];
  expectations: ExpectationResponse[];
}

export interface ElementCreate {
  element_type: string;
  content: string;
  element_order: number;
  metadata?: Record<string, any>;
  source_type?: string;
  source_chunk_ids?: string[];
  confidence?: number;
}

export interface ElementResponse {
  id: string;
  phase_id: string;
  element_type: string;
  content: string;
  element_order: number;
  metadata?: Record<string, any>;
  source_type?: string;
  source_chunk_ids?: string[];
  confidence?: number;
}

export interface ExpectationCreate {
  metric_type: string;
  metric_name: string;
  expected_value?: number;
  expected_value_max?: number;
  unit?: string;
  comparison: string;
  warning_threshold_percent?: number;
  critical_threshold_percent?: number;
  hypothesis?: string;
  based_on_persona_id?: string;
  data_source: string;
  data_source_config?: Record<string, any>;
}

export interface ExpectationResponse {
  id: string;
  phase_id: string;
  metric_type: string;
  metric_name: string;
  expected_value?: number;
  expected_value_max?: number;
  unit?: string;
  comparison: string;
  warning_threshold_percent?: number;
  critical_threshold_percent?: number;
  hypothesis?: string;
  based_on_persona_id?: string;
  data_source: string;
  data_source_config?: Record<string, any>;
  latest_measurement?: MeasurementSummary;
}

export interface MeasurementSummary {
  id: string;
  actual_value: number;
  delta_percent?: number;
  status: string;
  period_start: string;
  period_end: string;
  synced_at: string;
}

export interface MeasurementResponse {
  id: string;
  expectation_id: string;
  period_start: string;
  period_end: string;
  actual_value: number;
  delta_absolute?: number;
  delta_percent?: number;
  status: string;
  sample_size?: number;
  data_source?: string;
  raw_data?: Record<string, any>;
  synced_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ValidationRequest {
  persona_ids: string[];
  mode?: string;
}

export interface JourneyValidationReport {
  journey_id: string;
  overall_fit_score: number;
  phases: PhaseValidationResult[];
  validated_at: string;
}

export interface PhaseValidationResult {
  phase_id: string;
  phase_name: string;
  fit_score: number;
  status: string;
  friction_points: FrictionPoint[];
  recommendations: string[];
}

export interface FrictionPoint {
  description: string;
  severity: string;
  persona_quote?: string;
}

export interface InsightResponse {
  id: string;
  journey_id: string;
  phase_id?: string;
  expectation_id?: string;
  insight_type: string;
  title: string;
  description?: string;
  ai_analysis?: Record<string, any>;
  ai_recommendations?: string[];
  evidence?: Record<string, any>;
  confidence?: number;
  priority?: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ChangeResponse {
  id: string;
  journey_id: string;
  phase_id?: string;
  title: string;
  description?: string;
  change_type: string;
  triggered_by_insight_id?: string;
  expected_metric?: string;
  expected_improvement_percent?: number;
  implementation_status?: string;
  implemented_at?: string;
  actual_improvement_percent?: number;
  result_status?: string;
  created_at: string;
  updated_at: string;
}

export interface JourneyGenerateRequest {
  target_group_id: string;
  journey_type: string;
  organization_id: string;
  project_id?: string;
  created_by?: string;
  use_async?: boolean;
  /** "en" | "de" — drives `journey.full_generation` copy language. */
  output_locale?: string;
}

export type JourneyAiTemplateId = "journey_moments" | "phase_expectations";

export interface JourneyAiGenerateRequest {
  template_id: JourneyAiTemplateId;
  phase_id?: string;
  phase_context?: Record<string, unknown>;
  prompt_variables?: Record<string, unknown>;
  max_suggestions?: number;
  /** "en" | "de" — matches persona admin `output_locale`; drives ${generated_text_locale_name} in journey templates. */
  output_locale?: string;
}

export interface JourneyAiSuggestion {
  element_type?: string;
  title?: string;
  content: string;
}

export interface JourneyAiGenerationResponse {
  template_id: JourneyAiTemplateId | string;
  suggestions: JourneyAiSuggestion[];
  raw_output: string;
}

const buildJourneysUrl = (path: string, params?: URLSearchParams) => {
  const normalized = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  const base = buildApiUrl(`/api/journeys${normalized}`);
  const query = params?.toString();
  return query ? `${base}?${query}` : base;
};

// API Client
export const journeysApi = {
  // AI Generation
  generateJourney: async (data: JourneyGenerateRequest): Promise<JourneyResponse> => {
    const response = await fetch(buildJourneysUrl("/generate"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.text().catch(() => "");
      throw new Error(error || `Backend responded with ${response.status}`);
    }
    return response.json();
  },

  // CRUD Operations
  createJourney: async (data: JourneyCreate): Promise<JourneyResponse> => {
    const response = await fetch(buildJourneysUrl(""), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.text().catch(() => "");
      throw new Error(error || `Backend responded with ${response.status}`);
    }
    return response.json();
  },

  getJourney: async (id: string): Promise<JourneyResponse> => {
    const response = await fetch(buildJourneysUrl(`/${id}`), { cache: "no-store" });
    if (!response.ok) {
      const error = await response.text().catch(() => "");
      throw new Error(error || `Backend responded with ${response.status}`);
    }
    return response.json();
  },

  updateJourney: async (id: string, data: Partial<JourneyCreate>): Promise<JourneyResponse> => {
    const response = await fetch(buildJourneysUrl(`/${id}`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.text().catch(() => "");
      throw new Error(error || `Backend responded with ${response.status}`);
    }
    return response.json();
  },

  deleteJourney: async (id: string): Promise<void> => {
    const response = await fetch(buildJourneysUrl(`/${id}`), {
      method: "DELETE",
    });
    if (!response.ok) {
      const error = await response.text().catch(() => "");
      throw new Error(error || `Backend responded with ${response.status}`);
    }
  },

  listJourneys: async (params?: {
    target_group_id?: string;
    project_id?: string;
    page?: number;
    page_size?: number;
  }): Promise<JourneyResponse[]> => {
    const searchParams = new URLSearchParams();
    if (params?.target_group_id) searchParams.set("target_group_id", params.target_group_id);
    if (params?.project_id) searchParams.set("project_id", params.project_id);
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.page_size) searchParams.set("page_size", params.page_size.toString());
    
    const response = await fetch(buildJourneysUrl("", searchParams), { cache: "no-store" });
    if (!response.ok) {
      const error = await response.text().catch(() => "");
      throw new Error(error || `Backend responded with ${response.status}`);
    }
    return response.json();
  },

  // Phase Operations
  createPhase: async (journeyId: string, data: PhaseCreate): Promise<PhaseResponse> => {
    const response = await fetch(buildJourneysUrl(`/${journeyId}/phases`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.text().catch(() => "");
      throw new Error(error || `Backend responded with ${response.status}`);
    }
    return response.json();
  },

  updatePhase: async (journeyId: string, phaseId: string, data: Partial<PhaseCreate>): Promise<PhaseResponse> => {
    const response = await fetch(buildJourneysUrl(`/${journeyId}/phases/${phaseId}`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.text().catch(() => "");
      throw new Error(error || `Backend responded with ${response.status}`);
    }
    return response.json();
  },

  deletePhase: async (journeyId: string, phaseId: string): Promise<void> => {
    const response = await fetch(buildJourneysUrl(`/${journeyId}/phases/${phaseId}`), {
      method: "DELETE",
    });
    if (!response.ok) {
      const error = await response.text().catch(() => "");
      throw new Error(error || `Backend responded with ${response.status}`);
    }
  },

  reorderPhases: async (journeyId: string, phaseId: string, newOrder: number): Promise<void> => {
    const response = await fetch(
      buildJourneysUrl(
        `/${journeyId}/phases/${phaseId}/reorder`,
        new URLSearchParams({ new_order: newOrder.toString() })
      ),
      { method: "POST" }
    );
    if (!response.ok) {
      const error = await response.text().catch(() => "");
      throw new Error(error || `Backend responded with ${response.status}`);
    }
  },

  generateAiSuggestions: async (
    journeyId: string,
    payload: JourneyAiGenerateRequest
  ): Promise<JourneyAiGenerationResponse> => {
    const response = await fetch(buildJourneysUrl(`/${journeyId}/ai/generate`), {
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

  // Element Operations
  createElement: async (journeyId: string, phaseId: string, data: ElementCreate): Promise<ElementResponse> => {
    const response = await fetch(buildJourneysUrl(`/${journeyId}/phases/${phaseId}/elements`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.text().catch(() => "");
      throw new Error(error || `Backend responded with ${response.status}`);
    }
    return response.json();
  },

  updateElement: async (
    journeyId: string,
    phaseId: string,
    elementId: string,
    data: Partial<ElementCreate>
  ): Promise<ElementResponse> => {
    const response = await fetch(buildJourneysUrl(`/${journeyId}/phases/${phaseId}/elements/${elementId}`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.text().catch(() => "");
      throw new Error(error || `Backend responded with ${response.status}`);
    }
    return response.json();
  },

  deleteElement: async (journeyId: string, phaseId: string, elementId: string): Promise<void> => {
    const response = await fetch(buildJourneysUrl(`/${journeyId}/phases/${phaseId}/elements/${elementId}`), {
      method: "DELETE",
    });
    if (!response.ok) {
      const error = await response.text().catch(() => "");
      throw new Error(error || `Backend responded with ${response.status}`);
    }
  },

  // Expectation Operations
  createExpectation: async (
    journeyId: string,
    phaseId: string,
    data: ExpectationCreate
  ): Promise<ExpectationResponse> => {
    const response = await fetch(buildJourneysUrl(`/${journeyId}/phases/${phaseId}/expectations`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.text().catch(() => "");
      throw new Error(error || `Backend responded with ${response.status}`);
    }
    return response.json();
  },

  listExpectations: async (journeyId: string, phaseId: string): Promise<ExpectationResponse[]> => {
    const response = await fetch(buildJourneysUrl(`/${journeyId}/phases/${phaseId}/expectations`), {
      cache: "no-store",
    });
    if (!response.ok) {
      const error = await response.text().catch(() => "");
      throw new Error(error || `Backend responded with ${response.status}`);
    }
    return response.json();
  },

  // Validation
  validateJourney: async (journeyId: string, request: ValidationRequest): Promise<JourneyValidationReport> => {
    const response = await fetch(buildJourneysUrl(`/${journeyId}/validate`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      const error = await response.text().catch(() => "");
      throw new Error(error || `Backend responded with ${response.status}`);
    }
    return response.json();
  },

  getValidationReport: async (journeyId: string): Promise<JourneyValidationReport> => {
    const response = await fetch(buildJourneysUrl(`/${journeyId}/validation-report`), { cache: "no-store" });
    if (!response.ok) {
      const error = await response.text().catch(() => "");
      throw new Error(error || `Backend responded with ${response.status}`);
    }
    return response.json();
  },

  // Reality Tracking
  configureTracking: async (journeyId: string): Promise<void> => {
    const response = await fetch(buildJourneysUrl(`/${journeyId}/tracking/configure`), {
      method: "POST",
    });
    if (!response.ok) {
      const error = await response.text().catch(() => "");
      throw new Error(error || `Backend responded with ${response.status}`);
    }
  },

  syncMeasurements: async (journeyId: string): Promise<void> => {
    const response = await fetch(buildJourneysUrl(`/${journeyId}/tracking/sync`), {
      method: "POST",
    });
    if (!response.ok) {
      const error = await response.text().catch(() => "");
      throw new Error(error || `Backend responded with ${response.status}`);
    }
  },

  getMeasurements: async (journeyId: string): Promise<any[]> => {
    const response = await fetch(buildJourneysUrl(`/${journeyId}/measurements`), { cache: "no-store" });
    if (!response.ok) {
      const error = await response.text().catch(() => "");
      throw new Error(error || `Backend responded with ${response.status}`);
    }
    return response.json();
  },

  // Insights & Learning
  getInsights: async (journeyId: string): Promise<InsightResponse[]> => {
    const response = await fetch(buildJourneysUrl(`/${journeyId}/insights`), { cache: "no-store" });
    if (!response.ok) {
      const error = await response.text().catch(() => "");
      throw new Error(error || `Backend responded with ${response.status}`);
    }
    return response.json();
  },

  actionInsight: async (journeyId: string, insightId: string): Promise<void> => {
    const response = await fetch(buildJourneysUrl(`/${journeyId}/insights/${insightId}/action`), {
      method: "POST",
    });
    if (!response.ok) {
      const error = await response.text().catch(() => "");
      throw new Error(error || `Backend responded with ${response.status}`);
    }
  },

  // Change Tracking
  createChange: async (journeyId: string, data: Partial<ChangeResponse>): Promise<ChangeResponse> => {
    const response = await fetch(buildJourneysUrl(`/${journeyId}/changes`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.text().catch(() => "");
      throw new Error(error || `Backend responded with ${response.status}`);
    }
    return response.json();
  },

  listChanges: async (journeyId: string): Promise<ChangeResponse[]> => {
    const response = await fetch(buildJourneysUrl(`/${journeyId}/changes`), { cache: "no-store" });
    if (!response.ok) {
      const error = await response.text().catch(() => "");
      throw new Error(error || `Backend responded with ${response.status}`);
    }
    return response.json();
  },
};
