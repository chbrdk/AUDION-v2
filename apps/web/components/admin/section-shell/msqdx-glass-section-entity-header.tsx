"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Box, useTheme } from "@mui/material";
import { MsqdxButton, MsqdxCornerBox, MsqdxIcon } from "@msqdx/react";
import { SECTION_WORKSPACE_DOCK_BORDER_RADIUS_PX } from "../../../lib/section-nav-dock-layout";

export type MsqdxGlassSectionEntityHeaderProps = {
  scopeLabel?: string;
  entityTitle?: string;
  entitySubtitle?: string;
  backHref?: string;
  backLabel?: string;
  headerActions?: ReactNode;
  /** Title + meta live inside the black `MsqdxCornerBox` (36px radius, same as workspace frame). */
  entityCornerAccent?: boolean;
  className?: string;
};

export function MsqdxGlassSectionEntityHeader({
  scopeLabel,
  entityTitle,
  entitySubtitle,
  backHref,
  backLabel = "Back",
  headerActions,
  entityCornerAccent = false,
  className,
}: MsqdxGlassSectionEntityHeaderProps) {
  const theme = useTheme();
  const onAccentContrast = "var(--color-theme-accent-contrast, #ffffff)";

  const renderMainFields = (onAccent: boolean) => (
    <>
      {backHref ? (
        <Box className="msqdx-glass-section-shell__entity-back" sx={{ mb: 0.5 }}>
          <Link href={backHref} style={{ textDecoration: "none" }}>
            <MsqdxButton
              variant="text"
              size="small"
              startIcon={<MsqdxIcon name="arrow_back" customSize={18} />}
              sx={{
                px: 0,
                minWidth: 0,
                color: onAccent ? onAccentContrast : "var(--color-text-secondary)",
                ...(onAccent && {
                  "&:hover": { backgroundColor: theme.palette.action.hover },
                }),
              }}
            >
              {backLabel}
            </MsqdxButton>
          </Link>
        </Box>
      ) : null}
      {scopeLabel ? <span className="msqdx-glass-section-shell__scope">{scopeLabel}</span> : null}
      {entityTitle ? <h1 className="msqdx-glass-section-shell__title">{entityTitle}</h1> : null}
      {entitySubtitle ? <p className="msqdx-glass-section-shell__subtitle">{entitySubtitle}</p> : null}
    </>
  );

  return (
    <header
      className={[
        "msqdx-glass-section-shell__entity",
        entityCornerAccent ? "msqdx-glass-section-shell__entity--has-corner-accent" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {entityCornerAccent ? (
        <div className="msqdx-glass-section-shell__entity-hero">
          <MsqdxCornerBox
            className="msqdx-glass-section-shell__entity-corner-accent"
            topLeft="cutdown-a"
            topRight="rounded"
            bottomLeft="rounded"
            bottomRight="cutdown-b"
            borderRadius={SECTION_WORKSPACE_DOCK_BORDER_RADIUS_PX}
            sx={{
              width: "100%",
              minWidth: 0,
              boxSizing: "border-box",
              bgcolor: "var(--color-theme-accent, #000000)",
              color: onAccentContrast,
              position: "relative",
              py: "var(--msqdx-spacing-md)",
              px: "var(--msqdx-spacing-lg)",
              display: "flex",
              flexDirection: "column",
              alignItems: "stretch",
              justifyContent: "center",
            }}
          >
            <div className="msqdx-glass-section-shell__entity-main msqdx-glass-section-shell__entity-main--on-accent">
              {renderMainFields(true)}
            </div>
          </MsqdxCornerBox>
        </div>
      ) : (
        <div className="msqdx-glass-section-shell__entity-main">{renderMainFields(false)}</div>
      )}
      {headerActions ? (
        <Box sx={{ flexShrink: 0, position: "relative", zIndex: 1 }}>{headerActions}</Box>
      ) : null}
    </header>
  );
}
