"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Box } from "@mui/material";
import { MsqdxButton, MsqdxCornerBox, MsqdxIcon } from "@msqdx/react";
import { SECTION_WORKSPACE_DOCK_BORDER_RADIUS_PX } from "../../../lib/section-nav-dock-layout";

export type MsqdxGlassSectionEntityHeaderProps = {
  scopeLabel?: string;
  entityTitle?: string;
  entitySubtitle?: string;
  backHref?: string;
  backLabel?: string;
  headerActions?: ReactNode;
  /** Decorative patch top-right of the entity header; radius matches workspace frame (`SECTION_WORKSPACE_DOCK_BORDER_RADIUS_PX` / 36px). Cutdowns on the shape’s top-left + bottom-right, rounded top-right */
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
        <Box
          className="msqdx-glass-section-shell__entity-corner-accent"
          aria-hidden
          sx={{
            position: "absolute",
            top: -18,
            right: -18,
            width: { xs: 52, sm: 72, md: 496 },
            height: { xs: 36, sm: 44, md: 70 },
            pointerEvents: "none",
            zIndex: 0,
          }}
        >
          <MsqdxCornerBox
            topLeft="cutdown-a"
            topRight="rounded"
            bottomLeft="rounded"
            bottomRight="cutdown-b"
            borderRadius={SECTION_WORKSPACE_DOCK_BORDER_RADIUS_PX}
            sx={{
              width: "100%",
              height: "100%",
              boxSizing: "border-box",
              bgcolor: "var(--color-theme-accent, #000)",
            }}
          />
        </Box>
      ) : null}
      <div className="msqdx-glass-section-shell__entity-main">
        {backHref ? (
          <Box className="msqdx-glass-section-shell__entity-back" sx={{ mb: 0.5 }}>
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
      {headerActions ? (
        <Box sx={{ flexShrink: 0, position: "relative", zIndex: 1 }}>{headerActions}</Box>
      ) : null}
    </header>
  );
}
