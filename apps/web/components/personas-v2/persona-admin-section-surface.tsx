"use client";

import type { ReactNode } from "react";
import { Box } from "@mui/material";
import { MsqdxDashboardCard } from "@msqdx/react";
import { THEME_ACCENT } from "../../lib/theme-accent";
import { PersonaV2SectionBlock } from "./persona-v2-section-block";

export type PersonaAdminSectionSurfaceProps = {
  embedInSection?: boolean;
  cardId: string;
  title: string;
  icon: string;
  expanded: boolean;
  onToggle: (id: string) => void;
  /** Flat v2 block heading; ignored when `hideBlockTitle` is true. */
  blockTitle?: string;
  /** Shell workspace header already titles this block (e.g. profile hero). */
  hideBlockTitle?: boolean;
  children: ReactNode;
};

/**
 * Renders legacy accordion card (v1 / full) or flat v2 block inside persona section stacks.
 */
export function PersonaAdminSectionSurface({
  embedInSection = false,
  cardId,
  title,
  icon,
  expanded,
  onToggle,
  blockTitle,
  hideBlockTitle = false,
  children,
}: PersonaAdminSectionSurfaceProps) {
  if (embedInSection) {
    const flatTitle = hideBlockTitle ? undefined : (blockTitle ?? title);
    return <PersonaV2SectionBlock title={flatTitle}>{children}</PersonaV2SectionBlock>;
  }

  return (
    <Box sx={{ gridColumn: "1 / -1" }}>
      <MsqdxDashboardCard
        id={cardId}
        title={title}
        icon={icon}
        iconColor={{ color: THEME_ACCENT.color }}
        expanded={expanded}
        onToggle={onToggle}
      >
        {children}
      </MsqdxDashboardCard>
    </Box>
  );
}
