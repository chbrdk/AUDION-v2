"use client";

import type { PersonaProfile } from "@msqdx-glass/types";
import { MsqdxDashboardCard } from "@msqdx/react";
import { MsqdxGlassChipEditor } from "../generic/msqdx-glass-chip-editor";
import { useI18n } from "../i18n/i18n-provider";
import { THEME_ACCENT } from "../../lib/theme-accent";

export type MsqdxGlassPersonalityCardProps = {
  profile: PersonaProfile;
  expanded: boolean;
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
};

export const MsqdxGlassPersonalityCard = ({
  profile,
  expanded,
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
  highlightedTraits = []
}: MsqdxGlassPersonalityCardProps) => {
  const { t } = useI18n();
  // Convert traits Record<string, number> to string[] (only keys)
  const traitsArray = Object.keys(profile.traits || {}).map(trait => 
    trait.replace(/_/g, " ")
  );

  return (
    <MsqdxDashboardCard
      id="personality-values"
      title={t("personaAdmin.personalityValues")}
      icon="psychology"
      iconColor={{ color: THEME_ACCENT.color }}
      expanded={expanded}
      onToggle={onToggle}
    >
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
      />
      
      <MsqdxGlassChipEditor
        label={t("chat.interests")}
        chips={profile.interests || []}
        chipClassName="--interest"
        onSave={onSaveInterests || (async () => {})}
        editable={!!onSaveInterests}
        emptyMessage={t("personaAdmin.noInterests")}
        onAiSuggest={onAiSuggestInterests}
        aiLoading={aiInterestsLoading}
      />
      
      <MsqdxGlassChipEditor
        label={t("chat.values")}
        chips={profile.values || []}
        chipClassName="--value"
        onSave={onSaveValues || (async () => {})}
        editable={!!onSaveValues}
        emptyMessage={t("personaAdmin.noValues")}
        onAiSuggest={onAiSuggestValues}
        aiLoading={aiValuesLoading}
      />
      
      <MsqdxGlassChipEditor
        label={t("personaAdmin.socialMediaUsage")}
        chips={profile.social_media_usage || []}
        chipClassName="--social"
        onSave={onSaveSocialMedia || (async () => {})}
        editable={!!onSaveSocialMedia}
        emptyMessage={t("personaAdmin.noSocialMedia")}
      />
    </MsqdxDashboardCard>
  );
};

