"use client";

import { Box } from "@mui/material";
import { MsqdxCornerBox } from "@msqdx/react";
import {
  SECTION_NAV_DOCK_SURFACE,
  SECTION_WORKSPACE_DOCK_BORDER_RADIUS_PX,
  SECTION_WORKSPACE_DOCK_CORNER_STYLES,
} from "../../../lib/section-nav-dock-layout";
import { MsqdxGlassSectionEntityHeader } from "./msqdx-glass-section-entity-header";
import { MsqdxGlassSectionNav } from "./msqdx-glass-section-nav";
import type { MsqdxGlassSectionShellProps } from "./section-shell-types";

export function MsqdxGlassSectionShell({
  children,
  scopeLabel,
  entityTitle,
  entitySubtitle,
  backHref,
  backLabel = "Back",
  headerActions,
  entityCornerAccent = false,
  navItems = [],
  navLabel,
  activeSectionId,
  sectionTitle,
  sectionDescription,
  workspaceActions,
  hideSubNav = false,
  wideContent = false,
  className,
}: MsqdxGlassSectionShellProps) {
  const showEntityHeader = Boolean(
    scopeLabel || entityTitle || entitySubtitle || backHref || headerActions || entityCornerAccent
  );
  const showSubNav = !hideSubNav && navItems.length > 0;
  const showSectionHeader = Boolean(sectionTitle || sectionDescription || workspaceActions);

  const workspaceInner = (
    <>
      {showEntityHeader ? (
        <MsqdxGlassSectionEntityHeader
          scopeLabel={scopeLabel}
          entityTitle={entityTitle}
          entitySubtitle={entitySubtitle}
          backHref={backHref}
          backLabel={backLabel}
          headerActions={headerActions}
          entityCornerAccent={entityCornerAccent}
        />
      ) : null}

      <div className="msqdx-glass-section-workspace__main">
        {showSectionHeader ? (
          <div className="msqdx-glass-section-workspace__header">
            <div>
              {sectionTitle ? (
                <h2 className="msqdx-glass-section-workspace__section-title">{sectionTitle}</h2>
              ) : null}
              {sectionDescription ? (
                <p className="msqdx-glass-section-workspace__section-description">{sectionDescription}</p>
              ) : null}
            </div>
            {workspaceActions ? <Box sx={{ flexShrink: 0 }}>{workspaceActions}</Box> : null}
          </div>
        ) : null}

        <div
          className={[
            "msqdx-glass-section-workspace__content",
            wideContent ? "msqdx-glass-section-workspace__content--wide" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {children}
        </div>
      </div>
    </>
  );

  return (
    <Box
      className={[
        "msqdx-glass-section-shell",
        hideSubNav ? "msqdx-glass-section-shell--no-subnav" : "",
        showEntityHeader ? "msqdx-glass-section-shell--has-entity" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="msqdx-glass-section-shell__body">
        {showSubNav ? (
          <MsqdxGlassSectionNav items={navItems} activeSectionId={activeSectionId} navLabel={navLabel} />
        ) : null}

        <div
          className={[
            "msqdx-glass-section-workspace",
            showSubNav ? "msqdx-glass-section-workspace--with-subnav" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {showSubNav ? (
            <MsqdxCornerBox
              className="msqdx-glass-section-workspace__dock-shell"
              topLeft={SECTION_WORKSPACE_DOCK_CORNER_STYLES.topLeft}
              topRight={SECTION_WORKSPACE_DOCK_CORNER_STYLES.topRight}
              bottomLeft={SECTION_WORKSPACE_DOCK_CORNER_STYLES.bottomLeft}
              bottomRight={SECTION_WORKSPACE_DOCK_CORNER_STYLES.bottomRight}
              borderRadius={SECTION_WORKSPACE_DOCK_BORDER_RADIUS_PX}
              sx={{
                width: "100%",
                boxSizing: "border-box",
                bgcolor: "transparent",
                border: "none",
                display: "flex",
                flexDirection: "column",
                gap: "var(--msqdx-spacing-lg)",
                py: "var(--msqdx-spacing-lg)",
                px: "var(--msqdx-spacing-lg)",
                minWidth: 0,
              }}
            >
              {workspaceInner}
            </MsqdxCornerBox>
          ) : (
            workspaceInner
          )}
        </div>
      </div>
    </Box>
  );
}
