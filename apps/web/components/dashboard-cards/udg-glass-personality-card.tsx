"use client";

import type { PersonaProfile } from "@udg-glass/types";
import { UdgGlassDashboardCard } from "./udg-glass-dashboard-card";
import { UdgGlassDashboardCardSection } from "./udg-glass-dashboard-card-section";
import { UdgGlassChipEditor } from "../generic/udg-glass-chip-editor";

export type UdgGlassPersonalityCardProps = {
  profile: PersonaProfile;
  expanded: boolean;
  onToggle: (id: string) => void;
  onSaveInterests?: (chips: string[]) => Promise<void>;
  onSaveValues?: (chips: string[]) => Promise<void>;
  onSaveSocialMedia?: (chips: string[]) => Promise<void>;
  onSaveTraits?: (chips: string[]) => Promise<void>;
};

export const UdgGlassPersonalityCard = ({
  profile,
  expanded,
  onToggle,
  onSaveInterests,
  onSaveValues,
  onSaveSocialMedia,
  onSaveTraits
}: UdgGlassPersonalityCardProps) => {
  // Convert traits Record<string, number> to string[] (only keys)
  const traitsArray = Object.keys(profile.traits || {}).map(trait => 
    trait.replace(/_/g, " ")
  );

  return (
    <UdgGlassDashboardCard
      id="personality-values"
      title="Personality & Values"
      icon="psychology"
      variant="personality"
      iconColor={{
        color: "var(--color-secondary-dx-purple)"
      }}
      borderColor="var(--color-secondary-dx-purple)"
      expanded={expanded}
      onToggle={onToggle}
    >
      <UdgGlassChipEditor
        label="Personality (Traits)"
        chips={traitsArray}
        chipClassName="--trait"
        onSave={onSaveTraits || (async () => {})}
        editable={!!onSaveTraits}
        emptyMessage="No traits defined"
      />
      
      <UdgGlassChipEditor
        label="Interests"
        chips={profile.interests || []}
        chipClassName="--interest"
        onSave={onSaveInterests || (async () => {})}
        editable={!!onSaveInterests}
        emptyMessage="No interests"
      />
      
      <UdgGlassChipEditor
        label="Values"
        chips={profile.values || []}
        chipClassName="--value"
        onSave={onSaveValues || (async () => {})}
        editable={!!onSaveValues}
        emptyMessage="No values"
      />
      
      <UdgGlassChipEditor
        label="Social Media Usage"
        chips={profile.social_media_usage || []}
        chipClassName="--social"
        onSave={onSaveSocialMedia || (async () => {})}
        editable={!!onSaveSocialMedia}
        emptyMessage="No social media usage"
      />
    </UdgGlassDashboardCard>
  );
};

