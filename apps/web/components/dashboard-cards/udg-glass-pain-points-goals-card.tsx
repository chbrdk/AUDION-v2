"use client";

import type { ReactNode } from "react";

import type { PersonaProfile } from "@udg-glass/types";
import { UdgGlassDashboardCard } from "./udg-glass-dashboard-card";
import { UdgGlassChipEditor } from "../generic/udg-glass-chip-editor";

export type UdgGlassPainPointsGoalsCardProps = {
  profile: PersonaProfile;
  expanded: boolean;
  onToggle: (id: string) => void;
  onSavePainPoints?: (chips: string[]) => Promise<void>;
  onSaveGoals?: (chips: string[]) => Promise<void>;
  painPointsToolbar?: ReactNode;
};

export const UdgGlassPainPointsGoalsCard = ({
  profile,
  expanded,
  onToggle,
  onSavePainPoints,
  onSaveGoals,
  painPointsToolbar,
}: UdgGlassPainPointsGoalsCardProps) => {
  // Convert pain_points Array<{ label: string; evidence_count: number }> to string[] (only labels)
  const painPointsArray = (profile.pain_points || []).map(pp => pp.label);
  
  // Convert goals Array<{ label: string; priority: number }> to string[] (only labels)
  const goalsArray = (profile.goals || []).map(goal => goal.label);

  return (
    <UdgGlassDashboardCard
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
          {painPointsToolbar && <div className="udg-glass-pain-toolbar">{painPointsToolbar}</div>}
          <UdgGlassChipEditor
            label="Pain Points"
            chips={painPointsArray}
            chipClassName="--pain"
            onSave={onSavePainPoints || (async () => {})}
            editable={!!onSavePainPoints}
            emptyMessage="No pain points identified"
          />
        </div>
        <div>
          <UdgGlassChipEditor
            label="Goals"
            chips={goalsArray}
            chipClassName="--goal"
            onSave={onSaveGoals || (async () => {})}
            editable={!!onSaveGoals}
            emptyMessage="No goals defined"
          />
        </div>
      </div>
    </UdgGlassDashboardCard>
  );
};

