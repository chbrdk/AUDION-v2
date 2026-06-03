"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Box } from "@mui/material";
import type { PersonaListResponse } from "@msqdx-glass/types";
import { MsqdxButton } from "@msqdx/react";
import { ADMIN_ROUTES } from "../../lib/routes";
import { PERSONA_V2_DEFAULT_SECTION } from "../../lib/persona-v2-sections";
import {
  readPersonasOverviewViewModeFromStorage,
  writePersonasOverviewViewModeToStorage,
  type PersonasOverviewViewMode,
} from "../../lib/personas-overview-view-mode";
import { useI18n } from "../i18n/i18n-provider";
import { MsqdxGlassSectionShell } from "../admin/section-shell";
import { MsqdxGlassPersonasOverview } from "../personas/msqdx-glass-personas-overview";
import { PersonasOverviewLayoutToggle } from "../personas/personas-overview-layout-toggle";

export type MsqdxGlassPersonasV2OverviewProps = {
  initialList: PersonaListResponse;
};

export function MsqdxGlassPersonasV2Overview({ initialList }: MsqdxGlassPersonasV2OverviewProps) {
  const { t } = useI18n();
  const [layout, setLayout] = useState<PersonasOverviewViewMode>("cards");

  useEffect(() => {
    const saved = readPersonasOverviewViewModeFromStorage();
    if (saved) setLayout(saved);
  }, []);

  useEffect(() => {
    writePersonasOverviewViewModeToStorage(layout);
  }, [layout]);

  return (
    <MsqdxGlassSectionShell
      scopeLabel={t("personaV2.scopeLabel")}
      entityTitle={t("personaV2.overviewTitle")}
      hideSubNav
      headerActions={
        <Link href={ADMIN_ROUTES.personas} style={{ textDecoration: "none" }}>
          <MsqdxButton variant="outlined" size="small">
            {t("personaV2.openClassicList")}
          </MsqdxButton>
        </Link>
      }
      sectionTitle={t("personaV2.libraryTitle")}
      workspaceActions={
        <PersonasOverviewLayoutToggle
          value={layout}
          onChange={setLayout}
          cardsLabel={t("personaV2.library.viewCards")}
          listLabel={t("personaV2.library.viewList")}
          groupLabel={t("personaV2.library.layoutToggleLabel")}
        />
      }
    >
      <Box
        className="msqdx-glass-personas-v2-overview-grid"
        sx={{
          "& .msqdx-glass-personas-grid": {
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, minmax(0, 1fr))",
              lg: "repeat(2, minmax(0, 1fr))",
            },
            gap: 3,
          },
          "& .MuiCard-root, & .msqdx-molecule-card": {
            minHeight: 168,
          },
        }}
      >
        <MsqdxGlassPersonasOverview
          initialList={initialList}
          layout={layout}
          getPersonaDetailHref={(id) =>
            ADMIN_ROUTES.personaV2Section(id, PERSONA_V2_DEFAULT_SECTION)
          }
        />
      </Box>
    </MsqdxGlassSectionShell>
  );
}
