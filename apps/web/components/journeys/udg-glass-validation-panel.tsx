"use client";

import { type JourneyValidationReport, type PhaseValidationResult } from "../../app/api/_lib/journeys";
import { MaterialSymbol } from "../material-symbol";

export type UdgGlassValidationPanelProps = {
  validationReport: JourneyValidationReport | null;
  loading?: boolean;
  onValidate?: (personaIds: string[]) => Promise<void>;
  availablePersonas?: Array<{ id: string; name: string }>;
};

export const UdgGlassValidationPanel = ({
  validationReport,
  loading,
  onValidate,
  availablePersonas = [],
}: UdgGlassValidationPanelProps) => {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "var(--color-success)";
    if (score >= 60) return "var(--color-warning)";
    return "var(--color-error)";
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "high":
        return "var(--color-error)";
      case "medium":
        return "var(--color-warning)";
      case "low":
        return "var(--color-text-secondary)";
      default:
        return "var(--color-text-secondary)";
    }
  };

  if (loading) {
    return (
      <div className="udg-glass-card" style={{ padding: "2rem", textAlign: "center" }}>
        <MaterialSymbol icon="hourglass_empty" fontSize={24} />
        <p>Validating journey...</p>
      </div>
    );
  }

  if (!validationReport) {
    return (
      <div className="udg-glass-card" style={{ padding: "2rem" }}>
        <h2>Persona Validation</h2>
        <p style={{ color: "var(--color-text-secondary)", marginBottom: "1rem" }}>
          Validate this journey against personas to check fit scores and identify friction points.
        </p>
        {availablePersonas.length > 0 && onValidate && (
          <button
            className="udg-glass-button"
            onClick={() => {
              const personaIds = availablePersonas.map((p) => p.id);
              onValidate(personaIds);
            }}
          >
            <MaterialSymbol icon="verified" fontSize={16} /> Validate Journey
          </button>
        )}
        {availablePersonas.length === 0 && (
          <p style={{ color: "var(--color-text-secondary)", fontSize: "0.875rem" }}>
            No personas available for validation. Add personas to the target group first.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="udg-glass-card" style={{ padding: "2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h2>Validation Report</h2>
        <div
          style={{
            padding: "1rem",
            borderRadius: "8px",
            backgroundColor: "var(--color-surface)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)", marginBottom: "0.25rem" }}>
            Overall Fit Score
          </div>
          <div
            style={{
              fontSize: "2rem",
              fontWeight: "bold",
              color: getScoreColor(validationReport.overall_fit_score),
            }}
          >
            {validationReport.overall_fit_score.toFixed(1)}%
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {validationReport.phases.map((phaseResult: PhaseValidationResult) => (
          <div key={phaseResult.phase_id} style={{ padding: "1rem", backgroundColor: "var(--color-surface)", borderRadius: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0 }}>{phaseResult.phase_name}</h3>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span
                  style={{
                    padding: "0.25rem 0.5rem",
                    borderRadius: "4px",
                    fontSize: "0.875rem",
                    backgroundColor: getScoreColor(phaseResult.fit_score),
                    color: "white",
                  }}
                >
                  {phaseResult.fit_score.toFixed(1)}%
                </span>
                <span
                  style={{
                    padding: "0.25rem 0.5rem",
                    borderRadius: "4px",
                    fontSize: "0.75rem",
                    backgroundColor:
                      phaseResult.status === "good"
                        ? "var(--color-success)"
                        : phaseResult.status === "warning"
                          ? "var(--color-warning)"
                          : "var(--color-error)",
                    color: "white",
                  }}
                >
                  {phaseResult.status}
                </span>
              </div>
            </div>

            {phaseResult.friction_points.length > 0 && (
              <div style={{ marginTop: "1rem" }}>
                <h4 style={{ fontSize: "0.875rem", marginBottom: "0.5rem" }}>Friction Points</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {phaseResult.friction_points.map((fp, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: "0.75rem",
                        borderRadius: "4px",
                        borderLeft: `3px solid ${getSeverityColor(fp.severity)}`,
                        backgroundColor: "var(--color-background)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.25rem" }}>
                        <strong style={{ fontSize: "0.875rem" }}>{fp.description}</strong>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            color: getSeverityColor(fp.severity),
                            textTransform: "uppercase",
                          }}
                        >
                          {fp.severity}
                        </span>
                      </div>
                      {fp.persona_quote && (
                        <p style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", fontStyle: "italic", marginTop: "0.5rem" }}>
                          "{fp.persona_quote}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {phaseResult.recommendations.length > 0 && (
              <div style={{ marginTop: "1rem" }}>
                <h4 style={{ fontSize: "0.875rem", marginBottom: "0.5rem" }}>Recommendations</h4>
                <ul style={{ margin: 0, paddingLeft: "1.5rem", fontSize: "0.875rem" }}>
                  {phaseResult.recommendations.map((rec, idx) => (
                    <li key={idx} style={{ marginBottom: "0.25rem", color: "var(--color-text-secondary)" }}>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: "1.5rem", padding: "1rem", backgroundColor: "var(--color-surface)", borderRadius: "8px", fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>
        <MaterialSymbol icon="info" fontSize={16} /> Validated at: {new Date(validationReport.validated_at).toLocaleString()}
      </div>
    </div>
  );
};

