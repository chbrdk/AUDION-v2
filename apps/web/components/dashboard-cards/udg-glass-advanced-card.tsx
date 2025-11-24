"use client";

import type { PersonaProfile } from "@udg-glass/types";
import { UdgGlassDashboardCard } from "./udg-glass-dashboard-card";
import { UdgGlassDashboardCardSection } from "./udg-glass-dashboard-card-section";

export type UdgGlassAdvancedCardProps = {
  profile: PersonaProfile;
  expanded: boolean;
  onToggle: (id: string) => void;
};

export const UdgGlassAdvancedCard = ({
  profile,
  expanded,
  onToggle
}: UdgGlassAdvancedCardProps) => {
  // Only render if color_palette or attention_span exists
  if (!profile.color_palette?.length && !profile.attention_span) {
    return null;
  }

  return (
    <UdgGlassDashboardCard
      id="advanced"
      title="Erweitert"
      icon="tune"
      variant="advanced"
      iconColor={{
        color: "var(--color-secondary-dx-purple)"
      }}
      borderColor="var(--color-secondary-dx-purple)"
      expanded={expanded}
      onToggle={onToggle}
    >
      {profile.color_palette && profile.color_palette.length > 0 && (
        <UdgGlassDashboardCardSection title="Farbpalette">
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {profile.color_palette.map((color, idx) => (
              <div
                key={idx}
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  backgroundColor: color,
                  border: "1px solid var(--color-secondary-dx-grey-light-tint)",
                  cursor: "pointer",
                  boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                  transition: "transform 0.2s ease"
                }}
                title={color}
                onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.1)"}
                onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
              />
            ))}
          </div>
        </UdgGlassDashboardCardSection>
      )}
      {profile.attention_span && (
        <UdgGlassDashboardCardSection title="Attention Span">
          <p style={{ margin: 0 }}>{profile.attention_span}</p>
        </UdgGlassDashboardCardSection>
      )}
    </UdgGlassDashboardCard>
  );
};

