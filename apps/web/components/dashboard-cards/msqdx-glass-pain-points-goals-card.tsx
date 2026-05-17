"use client";

import type { ReactNode } from "react";
import { Box, Stack } from "@mui/material";
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
  /** Section shell already shows title — skip outer accordion card (persona v2). */
  embedInSection?: boolean;
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
  embedInSection = false,
}: MsqdxGlassPainPointsGoalsCardProps) => {
  const { t } = useI18n();
  const painPointsArray = (profile.pain_points || []).map((pp) => pp.label);
  const goalsArray = (profile.goals || []).map((goal) => goal.label);

  const body = (
    <Stack component="section" className="msqdx-glass-pain-goals-stack" spacing={2.5}>
      <Box
        component="article"
        className="msqdx-glass-pain-goals-stack__block msqdx-glass-pain-goals-panel-card --pain"
      >
        {painPointsToolbar ? <div className="msqdx-glass-pain-toolbar">{painPointsToolbar}</div> : null}
        <MsqdxGlassChipEditor
          label={t("personaAdmin.painPoints")}
          chips={painPointsArray}
          chipClassName="--pain"
          chipLayout="slider"
          slidesVisible={3.5}
          relaxedSpacing
          onSave={onSavePainPoints || (async () => {})}
          editable={!!onSavePainPoints}
          emptyMessage={t("personaAdmin.noPainPoints")}
          onAiSuggest={onAiSuggestPainPoints}
          aiLoading={aiPainPointsLoading}
        />
      </Box>
      <Box
        component="article"
        className="msqdx-glass-pain-goals-stack__block msqdx-glass-pain-goals-panel-card --goal"
      >
        <MsqdxGlassChipEditor
          label={t("personaAdmin.goals")}
          chips={goalsArray}
          chipClassName="--goal"
          chipLayout="slider"
          slidesVisible={3.5}
          relaxedSpacing
          onSave={onSaveGoals || (async () => {})}
          editable={!!onSaveGoals}
          emptyMessage={t("personaAdmin.noGoals")}
          onAiSuggest={onAiSuggestGoals}
          aiLoading={aiGoalsLoading}
        />
      </Box>
    </Stack>
  );

  if (embedInSection) {
    return (
      <Box sx={{ gridColumn: "1 / -1", width: "100%" }} className="msqdx-glass-pain-goals-section">
        {body}
      </Box>
    );
  }

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
        {body}
      </MsqdxDashboardCard>
    </Box>
  );
};
