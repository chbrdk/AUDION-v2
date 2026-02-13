"use client";

import type { ReactNode } from "react";
import { Box } from "@mui/material";
import type { PersonaProfile } from "@msqdx-glass/types";
import { MsqdxDashboardCard } from "@msqdx/react";
import { MsqdxGlassChipEditor } from "../generic/msqdx-glass-chip-editor";
import { useI18n } from "../i18n/i18n-provider";
import { THEME_ACCENT } from "../../lib/theme-accent";

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
  const { t } = useI18n();
  // Convert pain_points Array<{ label: string; evidence_count: number }> to string[] (only labels)
  const painPointsArray = (profile.pain_points || []).map(pp => pp.label);
  
  // Convert goals Array<{ label: string; priority: number }> to string[] (only labels)
  const goalsArray = (profile.goals || []).map(goal => goal.label);

  return (
    <Box sx={{ gridColumn: "1 / -1" }}>
    <MsqdxDashboardCard
      id="pain-points-goals"
      title={t("personaAdmin.painPointsGoals")}
      icon="target"
      iconColor={{ color: THEME_ACCENT.color }}
      expanded={expanded}
      onToggle={onToggle}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
        <div>
          {painPointsToolbar && <div className="msqdx-glass-pain-toolbar">{painPointsToolbar}</div>}
          <MsqdxGlassChipEditor
            label={t("personaAdmin.painPoints")}
            chips={painPointsArray}
            chipClassName="--pain"
            onSave={onSavePainPoints || (async () => {})}
            editable={!!onSavePainPoints}
            emptyMessage={t("personaAdmin.noPainPoints")}
            onAiSuggest={onAiSuggestPainPoints}
            aiLoading={aiPainPointsLoading}
          />
        </div>
        <div>
          <MsqdxGlassChipEditor
            label={t("personaAdmin.goals")}
            chips={goalsArray}
            chipClassName="--goal"
            onSave={onSaveGoals || (async () => {})}
            editable={!!onSaveGoals}
            emptyMessage={t("personaAdmin.noGoals")}
            onAiSuggest={onAiSuggestGoals}
            aiLoading={aiGoalsLoading}
          />
        </div>
      </div>
    </MsqdxDashboardCard>
    </Box>
  );
};

