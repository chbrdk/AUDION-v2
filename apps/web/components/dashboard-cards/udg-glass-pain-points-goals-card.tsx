"use client";

import type { PersonaProfile } from "@udg-glass/types";
import { UdgGlassDashboardCard } from "./udg-glass-dashboard-card";
import { UdgGlassDashboardCardSection } from "./udg-glass-dashboard-card-section";

export type UdgGlassPainPointsGoalsCardProps = {
  profile: PersonaProfile;
  expanded: boolean;
  onToggle: (id: string) => void;
};

export const UdgGlassPainPointsGoalsCard = ({
  profile,
  expanded,
  onToggle
}: UdgGlassPainPointsGoalsCardProps) => {
  return (
    <UdgGlassDashboardCard
      id="pain-points-goals"
      title="Pain Points & Ziele"
      icon="target"
      variant="pain-goals"
      fullWidth={true}
      iconColor={{
        color: "var(--color-secondary-dx-purple)"
      }}
      borderColor="var(--color-secondary-dx-purple)"
      expanded={expanded}
      onToggle={onToggle}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
        <div>
          {profile.pain_points && profile.pain_points.length > 0 ? (
            <UdgGlassDashboardCardSection title="Pain Points">
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {[...profile.pain_points]
                  .sort((a, b) => (b.evidence_count || 0) - (a.evidence_count || 0))
                  .map((pp, idx) => (
                    <span key={idx} className="udg-glass-chip --dashboard --pain">
                      {pp.label || pp.description}
                    </span>
                  ))}
              </div>
            </UdgGlassDashboardCardSection>
          ) : (
            <UdgGlassDashboardCardSection title="Pain Points">
              <p className="udg-glass-muted" style={{ margin: 0 }}>
                Keine Pain Points identifiziert
              </p>
            </UdgGlassDashboardCardSection>
          )}
        </div>
        <div>
          {profile.goals && profile.goals.length > 0 ? (
            <UdgGlassDashboardCardSection title="Ziele">
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {[...profile.goals]
                  .sort((a, b) => (a.priority || 999) - (b.priority || 999))
                  .map((goal, idx) => (
                    <span key={idx} className="udg-glass-chip --dashboard --goal">
                      {goal.label || goal.description}
                    </span>
                  ))}
              </div>
            </UdgGlassDashboardCardSection>
          ) : (
            <UdgGlassDashboardCardSection title="Ziele">
              <p className="udg-glass-muted" style={{ margin: 0 }}>
                Keine Ziele definiert
              </p>
            </UdgGlassDashboardCardSection>
          )}
        </div>
      </div>
    </UdgGlassDashboardCard>
  );
};

