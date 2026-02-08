"use client";

import type { PersonaProfile } from "@msqdx-glass/types";
import { MsqdxDashboardCard } from "@msqdx/react";
import { MsqdxGlassChipEditor } from "../generic/msqdx-glass-chip-editor";

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
  // Convert traits Record<string, number> to string[] (only keys)
  const traitsArray = Object.keys(profile.traits || {}).map(trait => 
    trait.replace(/_/g, " ")
  );

  return (
    <MsqdxDashboardCard
      id="personality-values"
      title="Personality & Values"
      icon="psychology"
      brandColor="black"
      iconColor={{ color: "var(--color-theme-accent)" }}
      expanded={expanded}
      onToggle={onToggle}
    >
      <MsqdxGlassChipEditor
        label="Personality (Traits)"
        chips={traitsArray}
        chipClassName="--trait"
        onSave={onSaveTraits || (async () => {})}
        editable={!!onSaveTraits}
        emptyMessage="No traits defined"
        onAiSuggest={onAiSuggestTraits}
        aiLoading={aiTraitsLoading}
        highlightedChips={highlightedTraits}
      />
      
      <MsqdxGlassChipEditor
        label="Interests"
        chips={profile.interests || []}
        chipClassName="--interest"
        onSave={onSaveInterests || (async () => {})}
        editable={!!onSaveInterests}
        emptyMessage="No interests"
        onAiSuggest={onAiSuggestInterests}
        aiLoading={aiInterestsLoading}
      />
      
      <MsqdxGlassChipEditor
        label="Values"
        chips={profile.values || []}
        chipClassName="--value"
        onSave={onSaveValues || (async () => {})}
        editable={!!onSaveValues}
        emptyMessage="No values"
        onAiSuggest={onAiSuggestValues}
        aiLoading={aiValuesLoading}
      />
      
      <MsqdxGlassChipEditor
        label="Social Media Usage"
        chips={profile.social_media_usage || []}
        chipClassName="--social"
        onSave={onSaveSocialMedia || (async () => {})}
        editable={!!onSaveSocialMedia}
        emptyMessage="No social media usage"
      />
    </MsqdxDashboardCard>
  );
};

