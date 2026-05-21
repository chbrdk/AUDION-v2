"use client";

import { Box, Stack } from "@mui/material";
import type { PersonaProfile } from "@msqdx-glass/types";
import { MsqdxDashboardCard } from "@msqdx/react";
import { MsqdxGlassChipEditor } from "../generic/msqdx-glass-chip-editor";
import { MsqdxGlassPainGoalsSectorSeparator } from "../generic/msqdx-glass-pain-goals-sector-separator";
import { useI18n } from "../i18n/i18n-provider";
import { THEME_ACCENT } from "../../lib/theme-accent";

const PERSONALITY_TRAITS_ID = "personality-traits";
const PERSONALITY_INTERESTS_ID = "personality-interests";
const PERSONALITY_VALUES_ID = "personality-values";

/** v2 stack: compact wrapping chips (not list rows or sliders). */
const SECTION_CHIP_PROPS = {
  chipLayout: "inline" as const,
};

export type MsqdxGlassPersonalityCardProps = {
  profile: PersonaProfile;
  expandedTraits: boolean;
  expandedInterests: boolean;
  expandedValues: boolean;
  onToggle: (id: string) => void;
  onSaveInterests?: (chips: string[]) => Promise<void>;
  onSaveValues?: (chips: string[]) => Promise<void>;
  onSaveSocialMedia?: (chips: string[]) => Promise<void>;
  onSaveTraits?: (chips: string[]) => Promise<void>;
  onAiSuggestTraits?: () => Promise<void>;
  aiTraitsLoading?: boolean;
  onAiSuggestInterests?: () => Promise<void>;
  aiInterestsLoading?: boolean;
  onAiSuggestValues?: () => Promise<void>;
  aiValuesLoading?: boolean;
  highlightedTraits?: string[];
  /** Section shell already shows title — flat stack only (persona v2). */
  embedInSection?: boolean;
};

export const MsqdxGlassPersonalityCard = ({
  profile,
  expandedTraits,
  expandedInterests,
  expandedValues,
  onToggle,
  onSaveInterests,
  onSaveValues,
  onSaveSocialMedia,
  onSaveTraits,
  onAiSuggestTraits,
  aiTraitsLoading = false,
  onAiSuggestInterests,
  aiInterestsLoading = false,
  onAiSuggestValues,
  aiValuesLoading = false,
  highlightedTraits = [],
  embedInSection = false,
}: MsqdxGlassPersonalityCardProps) => {
  const { t } = useI18n();
  const traitsArray = Object.keys(profile.traits || {}).map((trait) =>
    trait.replace(/_/g, " ")
  );

  const traitsBlock = (
    <MsqdxGlassChipEditor
      label={t("personaAdmin.personalityTraits")}
      chips={traitsArray}
      chipClassName="--trait"
      onSave={onSaveTraits || (async () => {})}
      editable={!!onSaveTraits}
      emptyMessage={t("personaAdmin.noTraits")}
      onAiSuggest={onAiSuggestTraits}
      aiLoading={aiTraitsLoading}
      highlightedChips={highlightedTraits}
      {...SECTION_CHIP_PROPS}
    />
  );

  const interestsBlock = (
    <MsqdxGlassChipEditor
      label={t("chat.interests")}
      chips={profile.interests || []}
      chipClassName="--interest"
      onSave={onSaveInterests || (async () => {})}
      editable={!!onSaveInterests}
      emptyMessage={t("personaAdmin.noInterests")}
      onAiSuggest={onAiSuggestInterests}
      aiLoading={aiInterestsLoading}
      {...SECTION_CHIP_PROPS}
    />
  );

  const valuesBlock = (
    <Stack spacing={1.5} sx={{ width: "100%" }}>
      <MsqdxGlassChipEditor
        label={t("chat.values")}
        chips={profile.values || []}
        chipClassName="--value"
        onSave={onSaveValues || (async () => {})}
        editable={!!onSaveValues}
        emptyMessage={t("personaAdmin.noValues")}
        onAiSuggest={onAiSuggestValues}
        aiLoading={aiValuesLoading}
        {...SECTION_CHIP_PROPS}
      />
      <MsqdxGlassChipEditor
        label={t("personaAdmin.socialMediaUsage")}
        chips={profile.social_media_usage || []}
        chipClassName="--social"
        onSave={onSaveSocialMedia || (async () => {})}
        editable={!!onSaveSocialMedia}
        emptyMessage={t("personaAdmin.noSocialMedia")}
        {...SECTION_CHIP_PROPS}
      />
    </Stack>
  );

  const stackBody = (
    <Stack component="section" className="msqdx-glass-personality-stack" spacing={0}>
      <Box component="article" className="msqdx-glass-personality-stack__block --trait">
        {traitsBlock}
      </Box>
      <MsqdxGlassPainGoalsSectorSeparator />
      <Box component="article" className="msqdx-glass-personality-stack__block --interest">
        {interestsBlock}
      </Box>
      <MsqdxGlassPainGoalsSectorSeparator />
      <Box component="article" className="msqdx-glass-personality-stack__block --value">
        {valuesBlock}
      </Box>
    </Stack>
  );

  if (embedInSection) {
    return (
      <Box sx={{ gridColumn: "1 / -1", width: "100%" }} className="msqdx-glass-personality-section">
        {stackBody}
      </Box>
    );
  }

  return (
    <>
      <MsqdxDashboardCard
        id={PERSONALITY_TRAITS_ID}
        title={t("personaAdmin.personalityTraits")}
        icon="psychology"
        iconColor={{ color: THEME_ACCENT.color }}
        expanded={expandedTraits}
        onToggle={onToggle}
      >
        {traitsBlock}
      </MsqdxDashboardCard>

      <MsqdxDashboardCard
        id={PERSONALITY_INTERESTS_ID}
        title={t("chat.interests")}
        icon="lightbulb"
        iconColor={{ color: THEME_ACCENT.color }}
        expanded={expandedInterests}
        onToggle={onToggle}
      >
        {interestsBlock}
      </MsqdxDashboardCard>

      <MsqdxDashboardCard
        id={PERSONALITY_VALUES_ID}
        title={t("chat.values")}
        icon="volunteer_activism"
        iconColor={{ color: THEME_ACCENT.color }}
        expanded={expandedValues}
        onToggle={onToggle}
      >
        {valuesBlock}
      </MsqdxDashboardCard>
    </>
  );
};
