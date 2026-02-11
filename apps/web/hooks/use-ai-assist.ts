import { useCallback, useState } from "react";

import { aiAssistApi, type AiAssistRequest, type AiAssistResponse, type AiAssistSuggestion } from "../app/api/_lib/ai-assist";
import {
  journeysApi,
  type JourneyAiGenerateRequest,
  type JourneyAiGenerationResponse,
  type JourneyAiSuggestion,
} from "../app/api/_lib/journeys";
import { useProject } from "../components/projects/project-provider";

export interface UiAiAssistResult {
  templateId: string;
  rawOutput: string;
  suggestions: AiAssistSuggestion[];
  provider?: string;
  model?: string;
  usage?: Record<string, unknown>;
}

export interface AiAssistExecuteOptions {
  templateId: string;
  journeyId?: string;
  phaseId?: string;
  phaseContext?: Record<string, unknown>;
  context?: Record<string, unknown>;
  promptVariables?: Record<string, unknown>;
  maxSuggestions?: number;
  provider?: AiAssistRequest["provider"];
  model?: string;
  projectId?: string;
}

export const useAiAssist = () => {
  const { activeProjectId } = useProject();
  const [result, setResult] = useState<UiAiAssistResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (options: AiAssistExecuteOptions): Promise<UiAiAssistResult> => {
      setLoading(true);
      setError(null);
      try {
        let response: UiAiAssistResult;
        const resolvedProjectId = options.projectId ?? activeProjectId ?? undefined;
        if (options.journeyId) {
          const payload: JourneyAiGenerateRequest = {
            template_id: options.templateId as any, // templateId can be any string for journey AI
            phase_id: options.phaseId,
            phase_context: options.phaseContext,
            prompt_variables: options.promptVariables,
            max_suggestions: options.maxSuggestions,
          };
          const journeyResponse: JourneyAiGenerationResponse = await journeysApi.generateAiSuggestions(
            options.journeyId,
            payload
          );
          response = {
            templateId: journeyResponse.template_id,
            rawOutput: journeyResponse.raw_output,
            suggestions: journeyResponse.suggestions.map(mapJourneySuggestion),
          };
        } else {
          const request: AiAssistRequest = {
            template_id: options.templateId,
            provider: options.provider,
            model: options.model,
            context: options.context,
            prompt_variables: options.promptVariables,
            max_suggestions: options.maxSuggestions,
          };
          const aiResponse: AiAssistResponse = await aiAssistApi.execute(request, resolvedProjectId);
          response = {
            templateId: aiResponse.template_id,
            rawOutput: aiResponse.raw_output,
            suggestions: aiResponse.suggestions,
            provider: aiResponse.provider,
            model: aiResponse.model,
            usage: aiResponse.usage,
          };
        }
        setResult(response);
        return response;
      } catch (err) {
        const message = err instanceof Error ? err.message : "AI request failed";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [activeProjectId]
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return {
    execute,
    loading,
    error,
    result,
    reset,
  };
};

const mapJourneySuggestion = (suggestion: JourneyAiSuggestion): AiAssistSuggestion => ({
  content: suggestion.content,
  title: suggestion.title,
  type: suggestion.element_type,
});

