"use client";

import type { PersonaProfile } from "@udg-glass/types";
import { UdgGlassDashboardCard } from "./udg-glass-dashboard-card";
import { UdgGlassDashboardCardSection } from "./udg-glass-dashboard-card-section";

export type UdgGlassCommunicationCardProps = {
  profile: PersonaProfile;
  expanded: boolean;
  onToggle: (id: string) => void;
};

export const UdgGlassCommunicationCard = ({
  profile,
  expanded,
  onToggle
}: UdgGlassCommunicationCardProps) => {
  if (!profile.communication_style) {
    return null;
  }

  return (
    <UdgGlassDashboardCard
      id="communication"
      title="Kommunikation"
      icon="chat_bubble"
      variant="communication"
      iconColor={{
        color: "var(--color-secondary-dx-purple)"
      }}
      borderColor="var(--color-secondary-dx-purple)"
      expanded={expanded}
      onToggle={onToggle}
    >
      {profile.communication_style.vocabulary && profile.communication_style.vocabulary.length > 0 && (
        <UdgGlassDashboardCardSection title="Vokabular">
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {profile.communication_style.vocabulary.map((word, idx) => (
              <span key={idx} className="udg-glass-chip --dashboard --vocab">
                {word}
              </span>
            ))}
          </div>
        </UdgGlassDashboardCardSection>
      )}
      {profile.communication_style.sentence_structure && (
        <UdgGlassDashboardCardSection title="Satzstruktur">
          <p style={{ margin: 0 }}>{profile.communication_style.sentence_structure}</p>
        </UdgGlassDashboardCardSection>
      )}
      <UdgGlassDashboardCardSection title="Skeptizismus">
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
            <span>Niedrig</span>
            <span>Hoch</span>
          </div>
          <div style={{ width: "100%", height: "10px", backgroundColor: "var(--color-neutral)", borderRadius: "5px", overflow: "hidden" }}>
            <div 
              style={{ 
                width: `${((profile.communication_style.skepticism_level || 0) / 5) * 100}%`, 
                height: "100%", 
                backgroundColor: "var(--color-secondary-dx-orange)",
                transition: "width 0.3s ease"
              }}
            />
          </div>
          <div style={{ fontSize: "0.875rem", color: "var(--color-muted)" }}>
            Level: {profile.communication_style.skepticism_level || 0} / 5
          </div>
        </div>
      </UdgGlassDashboardCardSection>
    </UdgGlassDashboardCard>
  );
};

