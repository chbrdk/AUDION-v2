"use client";

import { useRouter } from "next/navigation";
import { Box, Stack } from "@mui/material";
import { MsqdxMoleculeCard } from "@msqdx/react";
import { ADMIN_ROUTES } from "../../lib/routes";
import type { PersonaV2SectionId } from "../../lib/persona-v2-sections";
import { PERSONA_V2_SECTIONS } from "../../lib/persona-v2-sections";
import { useI18n } from "../i18n/i18n-provider";
import { MsqdxGlassPersonaAdminSectionView } from "./msqdx-glass-persona-admin-section-view";

export type MsqdxGlassPersonaV2SectionContentProps = {
  personaId: string;
  sectionId: PersonaV2SectionId;
  personaName?: string;
  docsUrl: string;
};

export function MsqdxGlassPersonaV2SectionContent({
  personaId,
  sectionId,
  docsUrl,
}: MsqdxGlassPersonaV2SectionContentProps) {
  const { t } = useI18n();
  const router = useRouter();

  if (sectionId === "overview") {
    return (
      <Stack spacing={2}>
        <div className="msqdx-glass-section-v2-banner">{t("personaV2.hubBanner")}</div>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
            gap: 2,
          }}
        >
          {PERSONA_V2_SECTIONS.filter((s) => s.id !== "overview").map((s) => (
            <MsqdxMoleculeCard
              key={s.id}
              variant="flat"
              borderRadius="button"
              clickable
              hoverable
              title={t(s.labelKey)}
              subtitle={t(s.descriptionKey)}
              onClick={() => router.push(ADMIN_ROUTES.personaV2Section(personaId, s.id))}
              sx={{
                minHeight: 120,
                border: "1px solid",
                borderColor: "var(--color-theme-accent-tint)",
              }}
            />
          ))}
        </Box>
      </Stack>
    );
  }

  return <MsqdxGlassPersonaAdminSectionView personaId={personaId} sectionId={sectionId} docsUrl={docsUrl} />;
}
