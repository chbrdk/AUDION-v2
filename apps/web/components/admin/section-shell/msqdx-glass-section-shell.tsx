"use client";

import Link from "next/link";
import { Box } from "@mui/material";
import { MsqdxButton, MsqdxIcon } from "@msqdx/react";
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
  const showEntityHeader = Boolean(scopeLabel || entityTitle || entitySubtitle || backHref || headerActions);
  const showSubNav = !hideSubNav && navItems.length > 0;
  const showSectionHeader = Boolean(sectionTitle || sectionDescription || workspaceActions);

  return (
    <Box
      className={[
        "msqdx-glass-section-shell",
        hideSubNav ? "msqdx-glass-section-shell--no-subnav" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {showEntityHeader ? (
        <header className="msqdx-glass-section-shell__entity">
          <div className="msqdx-glass-section-shell__entity-main">
            {backHref ? (
              <Box sx={{ mb: 0.5 }}>
                <Link href={backHref} style={{ textDecoration: "none" }}>
                  <MsqdxButton
                    variant="text"
                    size="small"
                    startIcon={<MsqdxIcon name="arrow_back" customSize={18} />}
                    sx={{ px: 0, minWidth: 0, color: "var(--color-text-secondary)" }}
                  >
                    {backLabel}
                  </MsqdxButton>
                </Link>
              </Box>
            ) : null}
            {scopeLabel ? <span className="msqdx-glass-section-shell__scope">{scopeLabel}</span> : null}
            {entityTitle ? <h1 className="msqdx-glass-section-shell__title">{entityTitle}</h1> : null}
            {entitySubtitle ? <p className="msqdx-glass-section-shell__subtitle">{entitySubtitle}</p> : null}
          </div>
          {headerActions ? <Box sx={{ flexShrink: 0 }}>{headerActions}</Box> : null}
        </header>
      ) : null}

      <div className="msqdx-glass-section-shell__body">
        {showSubNav ? (
          <MsqdxGlassSectionNav items={navItems} activeSectionId={activeSectionId} navLabel={navLabel} />
        ) : null}

        <div className="msqdx-glass-section-workspace">
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
      </div>
    </Box>
  );
}
