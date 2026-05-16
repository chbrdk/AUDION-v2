"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Box, Stack } from "@mui/material";
import { MsqdxButton, MsqdxMoleculeCard, MsqdxTypography } from "@msqdx/react";
import { ADMIN_ROUTES } from "../../lib/routes";
import type { PersonaV2SectionId } from "../../lib/persona-v2-sections";
import { getPersonaV2SectionDef, PERSONA_V2_SECTIONS } from "../../lib/persona-v2-sections";
import { useI18n } from "../i18n/i18n-provider";

export type MsqdxGlassPersonaV2SectionContentProps = {
  personaId: string;
  sectionId: PersonaV2SectionId;
  personaName?: string;
};

export function MsqdxGlassPersonaV2SectionContent({
  personaId,
  sectionId,
  personaName,
}: MsqdxGlassPersonaV2SectionContentProps) {
  const { t } = useI18n();
  const router = useRouter();
  const section = getPersonaV2SectionDef(sectionId);
  const v1Href = `${ADMIN_ROUTES.personaDetail(personaId)}#${section.v1AccordionId ?? ""}`;

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

  return (
    <Stack spacing={2}>
      <div className="msqdx-glass-section-v2-banner">
        {t("personaV2.sectionPlaceholder", { section: t(section.labelKey), name: personaName ?? personaId })}
      </div>
      <MsqdxMoleculeCard variant="flat" borderRadius="button" title={t("personaV2.migrationCardTitle")}>
        <MsqdxTypography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
          {t("personaV2.migrationCardBody")}
        </MsqdxTypography>
        <Link href={v1Href} style={{ textDecoration: "none" }}>
          <MsqdxButton variant="outlined" size="small">
            {t("personaV2.openClassicSection")}
          </MsqdxButton>
        </Link>
      </MsqdxMoleculeCard>
    </Stack>
  );
}
