"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Box } from "@mui/material";
import { MsqdxButton, MsqdxIcon } from "@msqdx/react";

export type MsqdxGlassSectionEntityHeaderProps = {
  scopeLabel?: string;
  entityTitle?: string;
  entitySubtitle?: string;
  backHref?: string;
  backLabel?: string;
  headerActions?: ReactNode;
  className?: string;
};

export function MsqdxGlassSectionEntityHeader({
  scopeLabel,
  entityTitle,
  entitySubtitle,
  backHref,
  backLabel = "Back",
  headerActions,
  className,
}: MsqdxGlassSectionEntityHeaderProps) {
  return (
    <header
      className={["msqdx-glass-section-shell__entity", className ?? ""].filter(Boolean).join(" ")}
    >
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
  );
}
