"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Box } from "@mui/material";
import type { TargetGroupListResponse } from "@msqdx-glass/types";
import { MsqdxButton } from "@msqdx/react";
import { ADMIN_ROUTES } from "../../lib/routes";
import { TARGET_GROUP_V2_DEFAULT_SECTION } from "../../lib/target-group-v2-sections";
import {
  readTargetGroupsOverviewViewModeFromStorage,
  writeTargetGroupsOverviewViewModeToStorage,
  type TargetGroupsOverviewViewMode,
} from "../../lib/target-groups-overview-view-mode";
import { useI18n } from "../i18n/i18n-provider";
import { MsqdxGlassSectionShell } from "../admin/section-shell";
import { MsqdxGlassTargetGroupsOverview } from "../target-groups/msqdx-glass-target-groups-overview";
import { PersonasOverviewLayoutToggle } from "../personas/personas-overview-layout-toggle";

export type MsqdxGlassTargetGroupsV2OverviewProps = {
  initialList: TargetGroupListResponse;
};

export function MsqdxGlassTargetGroupsV2Overview({ initialList }: MsqdxGlassTargetGroupsV2OverviewProps) {
  const { t } = useI18n();
  const [layout, setLayout] = useState<TargetGroupsOverviewViewMode>("cards");

  useEffect(() => {
    const saved = readTargetGroupsOverviewViewModeFromStorage();
    if (saved) setLayout(saved);
  }, []);

  useEffect(() => {
    writeTargetGroupsOverviewViewModeToStorage(layout);
  }, [layout]);

  return (
    <MsqdxGlassSectionShell
      scopeLabel={t("targetGroupV2.scopeLabel")}
      entityTitle={t("targetGroupV2.overviewTitle")}
      hideSubNav
      headerActions={
        <Link href={ADMIN_ROUTES.targetGroups} style={{ textDecoration: "none" }}>
          <MsqdxButton variant="outlined" size="small">
            {t("targetGroupV2.openClassicList")}
          </MsqdxButton>
        </Link>
      }
      sectionTitle={t("targetGroupV2.libraryTitle")}
      workspaceActions={
        <PersonasOverviewLayoutToggle
          value={layout}
          onChange={setLayout}
          cardsLabel={t("targetGroupV2.library.viewCards")}
          listLabel={t("targetGroupV2.library.viewList")}
          groupLabel={t("targetGroupV2.library.layoutToggleLabel")}
        />
      }
    >
      <Box
        className="msqdx-glass-target-groups-v2-overview-grid"
        sx={{
          "& .msqdx-glass-target-groups-grid": {
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
        <MsqdxGlassTargetGroupsOverview
          initialList={initialList}
          layout={layout}
          getTargetGroupDetailHref={(id) =>
            ADMIN_ROUTES.targetGroupV2Section(id, TARGET_GROUP_V2_DEFAULT_SECTION)
          }
        />
      </Box>
    </MsqdxGlassSectionShell>
  );
}
