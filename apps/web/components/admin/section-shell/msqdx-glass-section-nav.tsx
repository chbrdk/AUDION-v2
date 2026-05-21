"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Box } from "@mui/material";
import useMediaQuery from "@mui/material/useMediaQuery";
import { MsqdxCornerBox, MsqdxIcon } from "@msqdx/react";
import {
  SECTION_NAV_DOCK_BORDER_RADIUS_PX,
  SECTION_NAV_DOCK_CORNER_STYLES,
  SECTION_NAV_DOCK_SURFACE,
  SECTION_NAV_DOCK_TRACK_CLASS,
  SECTION_NAV_HORIZONTAL_ACTIVE_CORNER_STYLES,
  SECTION_NAV_HORIZONTAL_DOCK_CORNER_STYLES,
  SECTION_NAV_HORIZONTAL_MEDIA_QUERY,
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
  const isHorizontal = useMediaQuery(SECTION_NAV_HORIZONTAL_MEDIA_QUERY);
  const navRef = useRef<HTMLElement>(null);

  const dockCornerStyles = isHorizontal
    ? SECTION_NAV_HORIZONTAL_DOCK_CORNER_STYLES
    : SECTION_NAV_DOCK_CORNER_STYLES;

  const activeCornerStyles = isHorizontal
    ? SECTION_NAV_HORIZONTAL_ACTIVE_CORNER_STYLES
    : SECTION_NAV_DOCK_CORNER_STYLES;

  useEffect(() => {
    if (!compact || !isHorizontal || !activeSectionId) return;
    const shell = navRef.current?.querySelector<HTMLElement>(
      ".msqdx-glass-section-nav__dock-track"
    );
    const active = shell?.querySelector<HTMLElement>(
      ".msqdx-glass-section-nav__card-active-shell, .msqdx-glass-section-nav__card--active"
    );
    active?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [compact, isHorizontal, activeSectionId, items]);

  const navList = (
    <>
      {navLabel ? <span className="msqdx-glass-section-nav__label">{navLabel}</span> : null}
      {items.map((item) => {
        const isActive = activeSectionId === item.id;
        const cardClass = `msqdx-glass-section-nav__card${isActive ? " msqdx-glass-section-nav__card--active" : ""}`;
        const cardBody = (
          <>
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
          </>
        );

        if (compact && isActive) {
          return (
            <MsqdxCornerBox
              key={item.id}
              className="msqdx-glass-section-nav__card-active-shell"
              topLeft={activeCornerStyles.topLeft}
              topRight={activeCornerStyles.topRight}
              bottomLeft={activeCornerStyles.bottomLeft}
              bottomRight={activeCornerStyles.bottomRight}
              borderRadius={SECTION_NAV_DOCK_BORDER_RADIUS_PX}
              sx={{
                width: isHorizontal ? "auto" : "100%",
                flexShrink: 0,
                boxSizing: "border-box",
                overflow: "visible",
              }}
            >
              <Link
                href={item.href}
                className={cardClass}
                aria-current="page"
                title={item.description}
              >
                {cardBody}
              </Link>
            </MsqdxCornerBox>
          );
        }

        return (
          <Link
            key={item.id}
            href={item.href}
            className={cardClass}
            aria-current={isActive ? "page" : undefined}
            title={item.description}
          >
            {cardBody}
          </Link>
        );
      })}
    </>
  );

  return (
    <nav
      ref={navRef}
      className={[
        "msqdx-glass-section-nav",
        compact ? "msqdx-glass-section-nav--compact" : "",
        compact ? "msqdx-glass-section-nav--docked" : "",
        compact && isHorizontal ? "msqdx-glass-section-nav--horizontal" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={navLabel ?? "Section navigation"}
    >
      {compact ? (
        <MsqdxCornerBox
          className="msqdx-glass-section-nav__dock-shell"
          topLeft={dockCornerStyles.topLeft}
          topRight={dockCornerStyles.topRight}
          bottomLeft={dockCornerStyles.bottomLeft}
          bottomRight={dockCornerStyles.bottomRight}
          borderRadius={SECTION_NAV_DOCK_BORDER_RADIUS_PX}
          sx={{
            width: "100%",
            boxSizing: "border-box",
            bgcolor: SECTION_NAV_DOCK_SURFACE,
            overflow: "visible",
          }}
        >
          <Box
            className={SECTION_NAV_DOCK_TRACK_CLASS}
            sx={(theme) => ({
              display: "flex",
              flexDirection: isHorizontal ? "row" : "column",
              flexWrap: "nowrap",
              alignItems: isHorizontal ? "stretch" : "stretch",
              gap: theme.spacing(0.375),
              width: "100%",
              boxSizing: "border-box",
              overflowX: isHorizontal ? "auto" : "visible",
              overflowY: "visible",
              WebkitOverflowScrolling: isHorizontal ? "touch" : undefined,
              py: theme.spacing(0.75),
              pl: theme.spacing(0.75),
              pr: isHorizontal ? theme.spacing(0.75) : 0,
            })}
          >
            {navList}
          </Box>
        </MsqdxCornerBox>
      ) : (
        navList
      )}
    </nav>
  );
}
