"use client";

import type { PersonaProfile } from "@udg-glass/types";
import { UdgGlassDashboardCard } from "./udg-glass-dashboard-card";
import { UdgGlassDashboardCardSection } from "./udg-glass-dashboard-card-section";

export type UdgGlassPersonalityCardProps = {
  profile: PersonaProfile;
  expanded: boolean;
  onToggle: (id: string) => void;
};

export const UdgGlassPersonalityCard = ({
  profile,
  expanded,
  onToggle
}: UdgGlassPersonalityCardProps) => {
  return (
    <UdgGlassDashboardCard
      id="personality-values"
      title="Persönlichkeit & Werte"
      icon="psychology"
      variant="personality"
      iconColor={{
        color: "var(--color-secondary-dx-purple)"
      }}
      borderColor="var(--color-secondary-dx-purple)"
      expanded={expanded}
      onToggle={onToggle}
    >
      {Object.keys(profile.traits || {}).length > 0 && (
        <UdgGlassDashboardCardSection title="Persönlichkeit (Traits)">
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {Object.entries(profile.traits || {})
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .map(([trait]) => (
                <span key={trait} className="udg-glass-chip --dashboard --trait">
                  {trait.replace(/_/g, " ")}
                </span>
              ))}
          </div>
        </UdgGlassDashboardCardSection>
      )}
      {profile.interests && profile.interests.length > 0 && (
        <UdgGlassDashboardCardSection title="Interessen">
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {profile.interests.map((interest, idx) => (
              <span key={idx} className="udg-glass-chip --dashboard --interest">
                {interest}
              </span>
            ))}
          </div>
        </UdgGlassDashboardCardSection>
      )}
      {profile.values && profile.values.length > 0 && (
        <UdgGlassDashboardCardSection title="Werte">
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {profile.values.map((value, idx) => (
              <span key={idx} className="udg-glass-chip --dashboard --value">
                {value}
              </span>
            ))}
          </div>
        </UdgGlassDashboardCardSection>
      )}
      {profile.social_media_usage && profile.social_media_usage.length > 0 && (
        <UdgGlassDashboardCardSection title="Social Media Nutzung">
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {profile.social_media_usage.map((platform, idx) => (
              <span key={idx} className="udg-glass-chip --dashboard --social">
                {platform}
              </span>
            ))}
          </div>
        </UdgGlassDashboardCardSection>
      )}
    </UdgGlassDashboardCard>
  );
};

