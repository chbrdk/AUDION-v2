"use client";

import { useState, useEffect, useMemo } from "react";
import { MsqdxIcon } from "@msqdx/react";
import { useI18n } from "../i18n/i18n-provider";
import { generateMockContext, generateMockExtendedData, resolveExtendedVariable } from "./mockData";
import { journeysApi, type JourneyResponse } from "../../app/api/_lib/journeys";
import { targetGroupsApi, type TargetGroupResponse } from "../../app/api/_lib/target-groups";
import { aiAssistApi, type AiAssistResponse } from "../../app/api/_lib/ai-assist";
import { buildApiUrl } from "../../app/api/_lib/backend";
import { withOutputLocale } from "../../lib/ai-output-locale";

interface PreviewPanelProps {
  prompt: string;
  context: Record<string, any>;
  useMockData?: boolean;
}

export function PreviewPanel({ prompt, context, useMockData = false }: PreviewPanelProps) {
  const { t, locale } = useI18n();
  const [rendered, setRendered] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [enrichedContext, setEnrichedContext] = useState<Record<string, any>>(context);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<AiAssistResponse | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // Enrich context with standard variables from IDs
  useEffect(() => {
    const enrichContext = async () => {
      const enriched: Record<string, any> = { ...context };

      // Load journey data if journey_id is present
      if (context.journey_id && !useMockData) {
        try {
          const journey = await journeysApi.getJourney(context.journey_id);
          enriched.journey_name = journey.name;
          enriched.journey_type = journey.journey_type;
          enriched.journey_description = journey.description || "";
          
          // Build existing phases summary
          if (journey.phases && journey.phases.length > 0) {
            const sortedPhases = [...journey.phases].sort((a, b) => (a.phase_order || 0) - (b.phase_order || 0));
            enriched.existing_phases_summary = sortedPhases
              .map((p) => {
                const emotionInfo = p.expected_emotion
                  ? ` (Emotion: ${p.expected_emotion}${p.emotion_intensity ? `, Intensity: ${Math.round(p.emotion_intensity * 100)}%` : ""})`
                  : "";
                const durationInfo =
                  p.expected_duration_min && p.expected_duration_max
                    ? ` [Duration: ${p.expected_duration_min}-${p.expected_duration_max} ${p.duration_unit || "minutes"}]`
                    : "";
                const fullDescription = p.description || "No description provided.";
                return `Phase ${p.phase_order}: ${p.name}${emotionInfo}${durationInfo}\n   ${fullDescription}`;
              })
              .join("\n\n");
            enriched.existing_phases_count = sortedPhases.length;
            
            const lastPhase = sortedPhases[sortedPhases.length - 1];
            enriched.last_phase_summary = `LAST PHASE (Phase ${lastPhase.phase_order}):\nName: ${lastPhase.name}\nDescription: ${lastPhase.description || "No description provided."}\nEmotion: ${lastPhase.expected_emotion || "not defined"}${lastPhase.emotion_intensity ? ` (${Math.round(lastPhase.emotion_intensity * 100)}%)` : ""}\nDuration: ${lastPhase.expected_duration_min || "?"}-${lastPhase.expected_duration_max || "?"} ${lastPhase.duration_unit || "minutes"}`;
            enriched.last_phase_name = lastPhase.name;
            enriched.last_phase_emotion = lastPhase.expected_emotion || "";
            enriched.next_phase_number = sortedPhases.length + 1;
          }
          
          // Load phase data if phase_id is present
          if (context.phase_id && journey.phases) {
            const phase = journey.phases.find((p) => p.id === context.phase_id);
            if (phase) {
              enriched.phase_name = phase.name;
              enriched.phase_description = phase.description || "";
              enriched.phase_expected_emotion = phase.expected_emotion || "";
            }
          }
          
          // Load target group and personas if target_group_id is present
          if (journey.target_group_id) {
            try {
              const tg = await targetGroupsApi.getTargetGroup(journey.target_group_id);
              enriched.target_group_summary = `${tg.name}${tg.description ? `: ${tg.description}` : ""}`;
              
              // Try to load personas from target group
              try {
                const personaParams = new URLSearchParams({ page_size: "5" });
                if (journey.project_id) {
                  personaParams.set("project_id", journey.project_id);
                }
                const personasResponse = await fetch(
                  buildApiUrl(`/api/target-groups/${journey.target_group_id}/personas?${personaParams.toString()}`)
                );
                if (personasResponse.ok) {
                  const personasData = await personasResponse.json();
                  const personas = Array.isArray(personasData) ? personasData : personasData.items || [];
                  
                  if (personas.length > 0) {
                    const personaSummaries = await Promise.all(
                      personas.slice(0, 3).map(async (persona: any) => {
                        try {
                          const response = await fetch(buildApiUrl(`/api/persona-admin/${persona.id}`), { cache: "no-store" });
                          if (!response.ok) {
                            throw new Error(`HTTP ${response.status}`);
                          }
                          const fullPersona = await response.json();
                          const profile = fullPersona.profile;
                          const traits = profile?.traits ? Object.entries(profile.traits).map(([k, v]) => `${k}: ${v}`).slice(0, 5) : [];
                          const goals = profile?.goals ? profile.goals.map((g: any) => g.label || String(g)).slice(0, 3) : [];
                          const pains = profile?.pain_points ? profile.pain_points.map((p: any) => p.label || String(p)).slice(0, 3) : [];
                          
                          let summary = `- ${fullPersona.name || persona.name || "Unknown Persona"}:`;
                          if (traits.length > 0) {
                            summary += ` Traits: ${traits.join(", ")}.`;
                          }
                          if (goals.length > 0) {
                            summary += ` Goals: ${goals.join(", ")}.`;
                          }
                          if (pains.length > 0) {
                            summary += ` Pain Points: ${pains.join(", ")}.`;
                          }
                          return summary;
                        } catch (err) {
                          console.warn(`Failed to fetch persona ${persona.id}:`, err);
                          return `- ${persona.name || "Unknown Persona"}: (Details not available)`;
                        }
                      })
                    );
                    enriched.persona_summaries = personaSummaries.join("\n");
                  }
                }
              } catch (err) {
                console.warn("Failed to load personas:", err);
              }
            } catch (err) {
              console.error("Failed to load target group:", err);
            }
          }
        } catch (err) {
          console.error("Failed to load journey:", err);
        }
      }

      // Load target group data if target_group_id is present
      if (context.target_group_id && !useMockData) {
        try {
          const tg = await targetGroupsApi.getTargetGroup(context.target_group_id);
          enriched.target_group_summary = `${tg.name}${tg.description ? `: ${tg.description}` : ""}`;
        } catch (err) {
          console.error("Failed to load target group:", err);
        }
      }

      // Load persona data if persona_id is present
      if (context.persona_id && !useMockData) {
        try {
          const response = await fetch(buildApiUrl(`/api/persona-admin/${context.persona_id}`));
          if (response.ok) {
            const persona = await response.json();
            enriched.persona_name = persona.name || "";
            enriched.persona_headline = persona.profile?.headline || "";
            enriched.persona_bio = persona.profile?.bio || "";
            
            // Build summaries
            if (persona.profile?.traits) {
              const traits = Object.entries(persona.profile.traits)
                .map(([k, v]) => `${k}: ${v}`)
                .slice(0, 5)
                .join(", ");
              enriched.existing_traits = traits;
            }
            
            if (persona.profile?.goals) {
              const goals = persona.profile.goals
                .map((g: any) => g.label || String(g))
                .slice(0, 3)
                .join(", ");
              enriched.persona_goals = goals;
            }
            
            if (persona.profile?.pain_points) {
              const pains = persona.profile.pain_points
                .map((p: any) => p.label || String(p))
                .slice(0, 3)
                .join(", ");
              enriched.persona_pain_points = pains;
            }
          }
        } catch (err) {
          console.error("Failed to load persona:", err);
        }
      }

      // Add default values for common variables
      if (!enriched.max_items) enriched.max_items = 5;
      if (!enriched.max_suggestions) enriched.max_suggestions = 3;

      setEnrichedContext(enriched);
    };

    if (!useMockData && (context.journey_id || context.target_group_id || context.persona_id)) {
      enrichContext();
    } else {
      // Add default values even for mock data
      const withDefaults = { ...context };
      if (!withDefaults.max_items) withDefaults.max_items = 5;
      if (!withDefaults.max_suggestions) withDefaults.max_suggestions = 3;
      setEnrichedContext(withDefaults);
    }
  }, [context, useMockData]);

  // Debounced rendering
  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      try {
        const result = renderPrompt(prompt, enrichedContext, useMockData);
        setRendered(result.rendered);
        setErrors(result.errors);
      } catch (error) {
        setRendered("");
        setErrors([error instanceof Error ? error.message : "Failed to render prompt"]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [prompt, enrichedContext, useMockData]);

  const handleTestPrompt = async () => {
    if (!prompt.trim() || errors.length > 0) {
      return;
    }

    setTesting(true);
    setTestError(null);
    setTestResult(null);

    try {
      // Use the enriched context (which includes data loaded from IDs)
      const mockContext = generateMockContext();
      const effectiveContext = useMockData || Object.keys(enrichedContext).length === 0 
        ? { ...mockContext, ...enrichedContext } 
        : enrichedContext;

      // Call the new test endpoint
      const response = await aiAssistApi.testPrompt({
        prompt: prompt,
        context: withOutputLocale({ ...effectiveContext } as Record<string, unknown>, locale),
        temperature: 0.6,
        max_tokens: 1024,
      });

      setTestResult(response);
    } catch (error) {
      console.error("Test failed:", error);
      setTestError(error instanceof Error ? error.message : "Failed to test prompt");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--color-neutral)",
        borderLeft: "1px solid rgba(148, 163, 184, 0.2)",
      }}
    >
      <div style={{ padding: "1rem", borderBottom: "1px solid rgba(148, 163, 184, 0.2)", background: "var(--color-neutral)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <h3 style={{ margin: 0, fontSize: "0.875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Live Preview
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.75rem", color: "var(--color-text-secondary)" }}>
            <MsqdxIcon name={useMockData ? "science" : "database"} customSize={16} />
            <span>{useMockData ? "Mock Data" : "Real Data"}</span>
          </div>
        </div>
        <button
          onClick={handleTestPrompt}
          disabled={testing || !prompt.trim() || errors.length > 0}
          style={{
            width: "100%",
            padding: "0.5rem 1rem",
            background: testing ? "rgba(148, 163, 184, 0.3)" : "var(--color-theme-accent)",
            color: "white",
            border: "none",
            borderRadius: "6px",
            fontSize: "0.8125rem",
            fontWeight: 600,
            cursor: testing || !prompt.trim() || errors.length > 0 ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            transition: "background 0.2s ease",
            opacity: testing || !prompt.trim() || errors.length > 0 ? 0.6 : 1,
          }}
        >
          {testing ? (
            <>
              <MsqdxIcon name="hourglass_empty" customSize={16} />
              <span>Testing...</span>
            </>
          ) : (
            <>
              <MsqdxIcon name="play_arrow" customSize={16} />
              <span>Test Prompt with AI</span>
            </>
          )}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "1rem", position: "relative" }}>
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--color-text-secondary)", marginBottom: "1rem" }}>
            <MsqdxIcon name="hourglass_empty" customSize={16} />
            <span style={{ fontSize: "0.8125rem" }}>Rendering...</span>
          </div>
        )}

        {errors.length > 0 && (
          <div
            style={{
              padding: "0.75rem",
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "6px",
              marginBottom: "1rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "start", gap: "0.5rem" }}>
              <MsqdxIcon name="error" customSize={18} style={{ color: "rgba(239, 68, 68, 1)", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: "0 0 0.25rem", fontSize: "0.8125rem", fontWeight: 600, color: "rgba(239, 68, 68, 1)" }}>Errors:</p>
                <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.75rem", color: "rgba(239, 68, 68, 0.9)" }}>
                  {errors.map((error, idx) => (
                    <li key={idx}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {!loading && rendered && (
          <div
            style={{
              padding: "1rem",
              background: "var(--color-neutral)",
              borderRadius: "8px",
              border: "1px solid rgba(148, 163, 184, 0.2)",
              fontFamily: "monospace",
              fontSize: "0.8125rem",
              lineHeight: "1.6",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {rendered}
          </div>
        )}

        {!loading && !rendered && !errors.length && !testResult && (
          <div style={{ textAlign: "center", padding: "2rem", color: "var(--color-text-secondary)" }}>
            <MsqdxIcon name="description" customSize={32} style={{ marginBottom: "0.5rem", opacity: 0.5 }} />
            <p style={{ margin: 0, fontSize: "0.8125rem" }}>Enter a prompt to see the preview</p>
          </div>
        )}

        {/* Test Result */}
        {testResult && (
          <div style={{ marginTop: "1rem" }}>
            <div
              style={{
                padding: "1rem",
                background: "rgba(34, 197, 94, 0.1)",
                border: "1px solid rgba(34, 197, 94, 0.3)",
                borderRadius: "8px",
                marginBottom: "1rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                <h4 style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 600, color: "rgba(34, 197, 94, 1)" }}>
                  AI Response
                </h4>
                <button
                  onClick={() => {
                    setTestResult(null);
                    setTestError(null);
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "rgba(34, 197, 94, 1)",
                    cursor: "pointer",
                    padding: "0.25rem",
                    display: "flex",
                    alignItems: "center",
                  }}
                  title={t("promptBuilder.closeResult")}
                >
                  <MsqdxIcon name="close" customSize={18} />
                </button>
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", marginBottom: "0.75rem" }}>
                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                  <span>
                    <strong>Provider:</strong> {testResult.provider}
                  </span>
                  <span>
                    <strong>Model:</strong> {testResult.model}
                  </span>
                  <span>
                    <strong>Suggestions:</strong> {testResult.suggestions.length}
                  </span>
                </div>
              </div>
              {testResult.suggestions.length > 0 && (
                <div style={{ marginBottom: "1rem" }}>
                  <h5 style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Suggestions:
                  </h5>
                  <div style={{ display: "grid", gap: "0.5rem" }}>
                    {testResult.suggestions.map((suggestion, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: "0.75rem",
                          background: "rgba(15, 23, 42, 0.05)",
                          borderRadius: "6px",
                          border: "1px solid rgba(34, 197, 94, 0.2)",
                        }}
                      >
                        {suggestion.title && (
                          <div style={{ fontWeight: 600, marginBottom: "0.25rem", fontSize: "0.8125rem" }}>
                            {suggestion.title}
                          </div>
                        )}
                        <div style={{ fontSize: "0.8125rem", color: "var(--color-text-primary)", lineHeight: "1.5" }}>
                          {suggestion.content}
                        </div>
                        {suggestion.type && (
                          <div style={{ fontSize: "0.625rem", color: "var(--color-text-secondary)", marginTop: "0.25rem" }}>
                            Type: {suggestion.type}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {testResult.raw_output && (
                <div>
                  <h5 style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Raw Output:
                  </h5>
                  <pre
                    style={{
                      padding: "0.75rem",
                      background: "rgba(15, 23, 42, 0.1)",
                      borderRadius: "6px",
                      fontSize: "0.75rem",
                      fontFamily: "monospace",
                      overflowX: "auto",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      maxHeight: "300px",
                      overflowY: "auto",
                      margin: 0,
                    }}
                  >
                    {testResult.raw_output}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Test Error */}
        {testError && (
          <div
            style={{
              padding: "0.75rem",
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "6px",
              marginTop: "1rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "start", gap: "0.5rem" }}>
              <MsqdxIcon name="error" customSize={18} style={{ color: "rgba(239, 68, 68, 1)", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: "0 0 0.25rem", fontSize: "0.8125rem", fontWeight: 600, color: "rgba(239, 68, 68, 1)" }}>
                  Test Failed:
                </p>
                <p style={{ margin: 0, fontSize: "0.75rem", color: "rgba(239, 68, 68, 0.9)" }}>{testError}</p>
              </div>
              <button
                onClick={() => setTestError(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "rgba(239, 68, 68, 1)",
                  cursor: "pointer",
                  padding: "0.25rem",
                  display: "flex",
                  alignItems: "center",
                }}
                title={t("promptBuilder.closeError")}
              >
                <MsqdxIcon name="close" customSize={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function renderPrompt(
  prompt: string,
  context: Record<string, any>,
  useMockData: boolean
): { rendered: string; errors: string[] } {
  const errors: string[] = [];
  let rendered = prompt;

  // Use mock data if requested or if context is empty
  const mockContext = generateMockContext();
  const mockExtendedData = generateMockExtendedData();
  const effectiveContext = useMockData || Object.keys(context).length === 0 ? { ...mockContext, ...context } : context;

  // Replace standard variables: ${variable_name}
  const standardVarPattern = /\$\{(\w+)\}/g;
  rendered = rendered.replace(standardVarPattern, (match, varName) => {
    const value = effectiveContext[varName];
    if (value === undefined || value === null) {
      errors.push(`Variable '${varName}' not found in context`);
      return `[${varName} not found]`;
    }
    return String(value);
  });

  // Replace extended variables: ${resolver_type:${id_var}.path}
  const extendedVarPattern = /\$\{([a-z_]+):\$\{([^}]+)\}([^}]*)\}/g;
  rendered = rendered.replace(extendedVarPattern, (match, resolverType, idVar, propertyPath) => {
    const entityId = effectiveContext[idVar];
    if (!entityId) {
      errors.push(`Extended variable requires '${idVar}' in context`);
      return `[${idVar} not found]`;
    }

    if (useMockData) {
      // Use mock data for extended variables
      try {
        return resolveExtendedVariable(resolverType, propertyPath, mockExtendedData);
      } catch (error) {
        errors.push(`Failed to resolve ${resolverType}:${propertyPath}`);
        return `[Resolution error]`;
      }
    } else {
      // For real data, we would need to call the API
      // For now, return a placeholder
      return `[${resolverType}:${entityId}${propertyPath} - API resolution not implemented in preview]`;
    }
  });

  return { rendered, errors };
}
