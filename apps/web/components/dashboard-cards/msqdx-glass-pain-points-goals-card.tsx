"use client";

import type { ReactNode } from "react";

import type { PersonaProfile } from "@msqdx-glass/types";
import { MsqdxGlassDashboardCard } from "./msqdx-glass-dashboard-card";
import { MsqdxGlassChipEditor } from "../generic/msqdx-glass-chip-editor";

export type MsqdxGlassPainPointsGoalsCardProps = {
  profile: PersonaProfile;
  expanded: boolean;
  onToggle: (id: string) => void;
  onSavePainPoints?: (chips: string[]) => Promise<void>;
  onSaveGoals?: (chips: string[]) => Promise<void>;
  onAiSuggestPainPoints?: () => Promise<void>;
  aiPainPointsLoading?: boolean;
  onAiSuggestGoals?: () => Promise<void>;
  aiGoalsLoading?: boolean;
  painPointsToolbar?: ReactNode;
};

export const MsqdxGlassPainPointsGoalsCard = ({
  profile,
  expanded,
  onToggle,
  onSavePainPoints,
  onSaveGoals,
  onAiSuggestPainPoints,
  aiPainPointsLoading = false,
  onAiSuggestGoals,
  aiGoalsLoading = false,
  painPointsToolbar,
}: MsqdxGlassPainPointsGoalsCardProps) => {
  // Convert pain_points Array<{ label: string; evidence_count: number }> to string[] (only labels)
  const painPointsArray = (profile.pain_points || []).map(pp => pp.label);
  
  // Convert goals Array<{ label: string; priority: number }> to string[] (only labels)
  const goalsArray = (profile.goals || []).map(goal => goal.label);

  return (
    <MsqdxGlassDashboardCard
      id="pain-points-goals"
      title="Pain Points & Goals"
      icon="target"
      variant="pain-goals"
      fullWidth={true}
      iconColor={{
        color: "var(--color-theme-accent)"
      }}
      borderColor="var(--color-theme-accent)"
      expanded={expanded}
      onToggle={onToggle}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
        <div>
          {painPointsToolbar && <div className="msqdx-glass-pain-toolbar">{painPointsToolbar}</div>}
          <MsqdxGlassChipEditor
            label="Pain Points"
            chips={painPointsArray}
            chipClassName="--pain"
            onSave={onSavePainPoints || (async () => {})}
            editable={!!onSavePainPoints}
            emptyMessage="No pain points identified"
            onAiSuggest={onAiSuggestPainPoints}
            aiLoading={aiPainPointsLoading}
          />
        </div>
        <div>
          <MsqdxGlassChipEditor
            label="Goals"
            chips={goalsArray}
            chipClassName="--goal"
            onSave={onSaveGoals || (async () => {})}
            editable={!!onSaveGoals}
            emptyMessage="No goals defined"
            onAiSuggest={onAiSuggestGoals}
            aiLoading={aiGoalsLoading}
          />
        </div>
      </div>
    </MsqdxGlassDashboardCard>
  );
};

