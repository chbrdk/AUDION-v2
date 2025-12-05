"use client";

import { type PhaseResponse } from "../../app/api/_lib/journeys";
import { MaterialSymbol } from "../material-symbol";
import { UdgGlassPhaseCard } from "./udg-glass-phase-card";

export type UdgGlassJourneyCanvasProps = {
  phases: PhaseResponse[];
  selectedPhaseId?: string | null;
  onPhaseSelect?: (phaseId: string) => void;
  onPhaseReorder?: (fromIndex: number, toIndex: number) => void;
  onAddPhase?: () => void;
};

export const UdgGlassJourneyCanvas = ({
  phases,
  selectedPhaseId,
  onPhaseSelect,
  onPhaseReorder,
  onAddPhase,
}: UdgGlassJourneyCanvasProps) => {
  return (
    <div className="udg-glass-journey-canvas" style={{ padding: "1rem" }}>
      <div
        style={{
          display: "flex",
          gap: "1rem",
          overflowX: "auto",
          paddingBottom: "1rem",
        }}
      >
        {phases.map((phase, index) => (
          <UdgGlassPhaseCard
            key={phase.id}
            phase={phase}
            index={index}
            isSelected={selectedPhaseId === phase.id}
            onSelect={() => onPhaseSelect?.(phase.id)}
          />
        ))}
        <button
          className="udg-glass-button --ghost"
          type="button"
          style={{
            minWidth: "200px",
            height: "150px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            border: "2px dashed var(--color-border)",
            borderRadius: "8px",
          }}
          onClick={() => {
            onAddPhase?.();
          }}
        >
          <MaterialSymbol icon="add" fontSize={24} />
          <span>Add Phase</span>
        </button>
      </div>

      {/* Emotion Curve */}
      {phases.length > 0 && (
        <div style={{ marginTop: "2rem", padding: "1rem", backgroundColor: "var(--color-surface)", borderRadius: "8px" }}>
          <h3 style={{ marginBottom: "1rem" }}>Emotion Curve</h3>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", height: "100px", position: "relative" }}>
            {phases.map((phase, index) => {
              if (!phase.expected_emotion || typeof phase.emotion_intensity !== "number") return null;
              const intensity = phase.emotion_intensity * 100;
              const emotionColors: Record<string, string> = {
                frustrated: "var(--color-error)",
                anxious: "var(--color-warning)",
                neutral: "var(--color-text-secondary)",
                hopeful: "var(--color-success)",
                satisfied: "var(--color-primary)",
                delighted: "var(--color-theme-accent)",
              };
              return (
                <div
                  key={phase.id}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <div
                    style={{
                      width: "40px",
                      height: `${intensity}px`,
                      backgroundColor: emotionColors[phase.expected_emotion] || "var(--color-text-secondary)",
                      borderRadius: "4px",
                      minHeight: "10px",
                    }}
                  />
                  <span style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)" }}>
                    {phase.expected_emotion}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

