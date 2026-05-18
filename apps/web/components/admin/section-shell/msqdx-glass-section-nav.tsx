"use client";

import Link from "next/link";
import { MsqdxCornerBox, MsqdxIcon } from "@msqdx/react";
import {
  SECTION_NAV_DOCK_BORDER_RADIUS_PX,
  SECTION_NAV_DOCK_CORNER_STYLES,
  SECTION_NAV_DOCK_SURFACE,
} from "../../../lib/section-nav-dock-layout";
import type { SectionNavItem } from "./section-shell-types";

export type MsqdxGlassSectionNavProps = {
  items: SectionNavItem[];
  activeSectionId?: string;
  navLabel?: string;
  /** Dense rail for desktop sticky (icon + label only). */
  compact?: boolean;
};

export function MsqdxGlassSectionNav({
  items,
  activeSectionId,
  navLabel,
  compact = true,
}: MsqdxGlassSectionNavProps) {
  const navList = (
    <>
      {navLabel ? <span className="msqdx-glass-section-nav__label">{navLabel}</span> : null}
      {items.map((item) => {
        const isActive = activeSectionId === item.id;
        return (
          <Link
            key={item.id}
            href={item.href}
            className={`msqdx-glass-section-nav__card${isActive ? " msqdx-glass-section-nav__card--active" : ""}`}
            aria-current={isActive ? "page" : undefined}
            title={item.description}
          >
            {item.icon ? (
              <span className="msqdx-glass-section-nav__icon" aria-hidden>
                <MsqdxIcon name={item.icon} customSize={compact ? 18 : 22} />
              </span>
            ) : null}
            <span className="msqdx-glass-section-nav__text">
              <span className="msqdx-glass-section-nav__title">{item.label}</span>
              {item.description ? (
                <span className="msqdx-glass-section-nav__description">{item.description}</span>
              ) : null}
            </span>
          </Link>
        );
      })}
    </>
  );

  return (
    <nav
      className={[
        "msqdx-glass-section-nav",
        compact ? "msqdx-glass-section-nav--compact" : "",
        compact ? "msqdx-glass-section-nav--docked" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={navLabel ?? "Section navigation"}
    >
      {compact ? (
        <MsqdxCornerBox
          className="msqdx-glass-section-nav__dock-shell"
          topLeft={SECTION_NAV_DOCK_CORNER_STYLES.topLeft}
          topRight={SECTION_NAV_DOCK_CORNER_STYLES.topRight}
          bottomLeft={SECTION_NAV_DOCK_CORNER_STYLES.bottomLeft}
          bottomRight={SECTION_NAV_DOCK_CORNER_STYLES.bottomRight}
          borderRadius={SECTION_NAV_DOCK_BORDER_RADIUS_PX}
          sx={{
            width: "100%",
            boxSizing: "border-box",
            bgcolor: SECTION_NAV_DOCK_SURFACE,
            display: "flex",
            flexDirection: "column",
            gap: 0.375,
            py: 0.75,
            px: 0.75,
          }}
        >
          {navList}
        </MsqdxCornerBox>
      ) : (
        navList
      )}
    </nav>
  );
}
