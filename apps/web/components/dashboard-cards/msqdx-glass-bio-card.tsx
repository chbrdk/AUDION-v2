"use client";

import { Box } from "@mui/material";
import type { PersonaProfile } from "@msqdx-glass/types";
import { MsqdxDashboardCard } from "@msqdx/react";
import { MsqdxGlassDashboardCardSection } from "./msqdx-glass-dashboard-card-section";
import { useI18n } from "../i18n/i18n-provider";
import { THEME_ACCENT } from "../../lib/theme-accent";

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
  const { t } = useI18n();
  const genderLabel =
    profile.gender === "male"
      ? t("personaAdmin.genderMale")
      : profile.gender === "female"
        ? t("personaAdmin.genderFemale")
        : profile.gender === "diverse"
          ? t("personaAdmin.genderDiverse")
          : profile.gender;

  return (
    <Box sx={{ gridColumn: "1 / -1" }}>
    <MsqdxDashboardCard
      id="bio-demographics"
      title={t("personaAdmin.bioDemographics")}
      icon="person"
      iconColor={{ color: THEME_ACCENT.color }}
      expanded={expanded}
      onToggle={onToggle}
    >
      {profile.bio && (
        <MsqdxGlassDashboardCardSection title={t("personaAdmin.biography")}>
          <p style={{ lineHeight: "1.6", whiteSpace: "pre-wrap", margin: 0 }}>
            {profile.bio}
          </p>
        </MsqdxGlassDashboardCardSection>
      )}
      {(profile.full_name || profile.age || profile.location || profile.gender || (profile.media_affinity !== null && profile.media_affinity !== undefined)) && (
        <MsqdxGlassDashboardCardSection title={t("personaAdmin.demographics")}>
          <dl className="msqdx-glass-meta-grid" style={{ margin: 0 }}>
            {profile.full_name && (
              <div>
                <dt>{t("personaAdmin.fullName")}</dt>
                <dd>{profile.full_name}</dd>
              </div>
            )}
            {profile.age && (
              <div>
                <dt>{t("personaAdmin.age")}</dt>
                <dd>{profile.age} {t("personaAdmin.years")}</dd>
              </div>
            )}
            {profile.location && (
              <div>
                <dt>{t("personaAdmin.location")}</dt>
                <dd>{profile.location}</dd>
              </div>
            )}
            {profile.gender && (
              <div>
                <dt>{t("personaAdmin.gender")}</dt>
                <dd>{genderLabel}</dd>
              </div>
            )}
            {profile.media_affinity !== null && profile.media_affinity !== undefined && (
              <div>
                <dt>{t("personaAdmin.mediaAffinity")}</dt>
                <dd>{profile.media_affinity}/100</dd>
              </div>
            )}
          </dl>
        </MsqdxGlassDashboardCardSection>
      )}
    </MsqdxDashboardCard>
    </Box>
  );
};

