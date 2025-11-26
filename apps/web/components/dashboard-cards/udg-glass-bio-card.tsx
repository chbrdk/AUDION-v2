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
      title="Biography & Demographics"
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
        <UdgGlassDashboardCardSection title="Biography">
          <p style={{ lineHeight: "1.6", whiteSpace: "pre-wrap", margin: 0 }}>
            {profile.bio}
          </p>
        </UdgGlassDashboardCardSection>
      )}
      {(profile.full_name || profile.age || profile.location || profile.gender || (profile.media_affinity !== null && profile.media_affinity !== undefined)) && (
        <UdgGlassDashboardCardSection title="Demographics">
          <dl className="udg-glass-meta-grid" style={{ margin: 0 }}>
            {profile.full_name && (
              <div>
                <dt>Full Name</dt>
                <dd>{profile.full_name}</dd>
              </div>
            )}
            {profile.age && (
              <div>
                <dt>Age</dt>
                <dd>{profile.age} years</dd>
              </div>
            )}
            {profile.location && (
              <div>
                <dt>Location</dt>
                <dd>{profile.location}</dd>
              </div>
            )}
            {profile.gender && (
              <div>
                <dt>Gender</dt>
                <dd>
                  {profile.gender === "male" ? "Male" :
                   profile.gender === "female" ? "Female" :
                   profile.gender === "diverse" ? "Diverse" :
                   profile.gender}
                </dd>
              </div>
            )}
            {profile.media_affinity !== null && profile.media_affinity !== undefined && (
              <div>
                <dt>Media Affinity</dt>
                <dd>{profile.media_affinity}/100</dd>
              </div>
            )}
          </dl>
        </UdgGlassDashboardCardSection>
      )}
    </UdgGlassDashboardCard>
  );
};

