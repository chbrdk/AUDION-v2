"use client";

import type { PersonaProfile } from "@udg-glass/types";
import { UdgGlassDashboardCard } from "./udg-glass-dashboard-card";
import { UdgGlassDashboardCardSection } from "./udg-glass-dashboard-card-section";

export type UdgGlassBioCardProps = {
  profile: PersonaProfile;
  expanded: boolean;
  onToggle: (id: string) => void;
};

export const UdgGlassBioCard = ({
  profile,
  expanded,
  onToggle
}: UdgGlassBioCardProps) => {
  return (
    <UdgGlassDashboardCard
      id="bio-demographics"
      title="Biografie & Demographie"
      icon="person"
      variant="bio"
      fullWidth={true}
      iconColor={{
        color: "var(--color-secondary-dx-purple)"
      }}
      borderColor="var(--color-secondary-dx-purple)"
      expanded={expanded}
      onToggle={onToggle}
    >
      {profile.bio && (
        <UdgGlassDashboardCardSection title="Biografie">
          <p style={{ lineHeight: "1.6", whiteSpace: "pre-wrap", margin: 0 }}>
            {profile.bio}
          </p>
        </UdgGlassDashboardCardSection>
      )}
      {(profile.full_name || profile.age || profile.location) && (
        <UdgGlassDashboardCardSection title="Demographie">
          <dl className="udg-glass-meta-grid" style={{ margin: 0 }}>
            {profile.full_name && (
              <div>
                <dt>Vollständiger Name</dt>
                <dd>{profile.full_name}</dd>
              </div>
            )}
            {profile.age && (
              <div>
                <dt>Alter</dt>
                <dd>{profile.age} Jahre</dd>
              </div>
            )}
            {profile.location && (
              <div>
                <dt>Standort</dt>
                <dd>{profile.location}</dd>
              </div>
            )}
          </dl>
        </UdgGlassDashboardCardSection>
      )}
    </UdgGlassDashboardCard>
  );
};

