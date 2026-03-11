"use client";

import type { PersonaProfile } from "@msqdx-glass/types";
import { MsqdxDashboardCard } from "@msqdx/react";
import { MsqdxGlassChipEditor } from "../generic/msqdx-glass-chip-editor";
import { useI18n } from "../i18n/i18n-provider";
import { THEME_ACCENT } from "../../lib/theme-accent";

const PERSONALITY_TRAITS_ID = "personality-traits";
const PERSONALITY_INTERESTS_ID = "personality-interests";
const PERSONALITY_VALUES_ID = "personality-values";

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
}: MsqdxGlassPersonalityCardProps) => {
  const { t } = useI18n();
  const traitsArray = Object.keys(profile.traits || {}).map((trait) =>
    trait.replace(/_/g, " ")
  );

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
      </MsqdxDashboardCard>

      <MsqdxDashboardCard
        id={PERSONALITY_INTERESTS_ID}
        title={t("chat.interests")}
        icon="lightbulb"
        iconColor={{ color: THEME_ACCENT.color }}
        expanded={expandedInterests}
        onToggle={onToggle}
      >
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
      </MsqdxDashboardCard>

      <MsqdxDashboardCard
        id={PERSONALITY_VALUES_ID}
        title={t("chat.values")}
        icon="volunteer_activism"
        iconColor={{ color: THEME_ACCENT.color }}
        expanded={expandedValues}
        onToggle={onToggle}
      >
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
    </>
  );
};

