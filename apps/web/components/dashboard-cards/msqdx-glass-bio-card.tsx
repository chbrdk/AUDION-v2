"use client";

import type { PersonaProfile } from "@msqdx-glass/types";
import { MsqdxGlassDashboardCard } from "./msqdx-glass-dashboard-card";
import { MsqdxGlassDashboardCardSection } from "./msqdx-glass-dashboard-card-section";

export type MsqdxGlassBioCardProps = {
  profile: PersonaProfile;
  expanded: boolean;
  onToggle: (id: string) => void;
};

export const MsqdxGlassBioCard = ({
  profile,
  expanded,
  onToggle
}: MsqdxGlassBioCardProps) => {
  return (
    <MsqdxGlassDashboardCard
      id="bio-demographics"
      title="Biography & Demographics"
      icon="person"
      variant="bio"
      fullWidth={true}
      iconColor={{
        color: "var(--color-theme-accent)"
      }}
      borderColor="var(--color-theme-accent)"
      expanded={expanded}
      onToggle={onToggle}
    >
      {profile.bio && (
        <MsqdxGlassDashboardCardSection title="Biography">
          <p style={{ lineHeight: "1.6", whiteSpace: "pre-wrap", margin: 0 }}>
            {profile.bio}
          </p>
        </MsqdxGlassDashboardCardSection>
      )}
      {(profile.full_name || profile.age || profile.location || profile.gender || (profile.media_affinity !== null && profile.media_affinity !== undefined)) && (
        <MsqdxGlassDashboardCardSection title="Demographics">
          <dl className="msqdx-glass-meta-grid" style={{ margin: 0 }}>
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
        </MsqdxGlassDashboardCardSection>
      )}
    </MsqdxGlassDashboardCard>
  );
};

