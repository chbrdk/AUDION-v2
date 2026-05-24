"use client";

import clsx from "clsx";
import type { ReactNode } from "react";
import { MsqdxCornerTabCard } from "../../../lib/msqdx-corner-tab-card";
import { MSQDX_GLASS_CORNER_TAB_SECTION_BORDER_RADIUS_PX } from "../../../lib/msqdx-corner-tab-section";

export type MsqdxGlassCornerTabSectionPlacement = "top-left" | "top-right";

export type MsqdxGlassCornerTabSectionProps = {
  children: ReactNode;
  /** Corner tab region (icon, or heading + actions via {@link MsqdxGlassCornerTabSectionTab}). */
  tab: ReactNode;
  /** Accessible name for the corner tab. */
  tabAriaLabel: string;
  /** @default 'top-right' */
  placement?: MsqdxGlassCornerTabSectionPlacement;
  /**
   * When true, tab width follows content (heading + toolbar) and section gets toolbar spacing.
   * @default false
   */
  tabToolbar?: boolean;
  className?: string;
};

/**
 * Glass section shell with a cutout corner tab (no slider).
 * Wraps {@link MsqdxCornerTabCard} with AUDION surface tokens and standardized BEM classes.
 */
export function MsqdxGlassCornerTabSection({
  children,
  tab,
  tabAriaLabel,
  placement = "top-right",
  tabToolbar = false,
  className,
}: MsqdxGlassCornerTabSectionProps) {
  const placementSide = placement === "top-right" ? "right" : "left";

  return (
    <MsqdxCornerTabCard
      className={clsx(
        "msqdx-glass-corner-tab-section",
        `msqdx-glass-corner-tab-section--${placementSide}`,
        tabToolbar && "msqdx-glass-corner-tab-section--with-toolbar",
        className
      )}
      placement={placement}
      tab={tab}
      tabWidthAuto={tabToolbar}
      tabAriaLabel={tabAriaLabel}
      bodyBorderRadiusPx={MSQDX_GLASS_CORNER_TAB_SECTION_BORDER_RADIUS_PX}
      cornerBoxBorderRadiusPx={MSQDX_GLASS_CORNER_TAB_SECTION_BORDER_RADIUS_PX}
      containerBorderRadiusPx={MSQDX_GLASS_CORNER_TAB_SECTION_BORDER_RADIUS_PX}
      bodySx={{ pr: 0.25 }}
    >
      {children}
    </MsqdxCornerTabCard>
  );
}
