"use client";

import Link from "next/link";
import { MsqdxIcon } from "@msqdx/react";
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
  return (
    <nav
      className={[
        "msqdx-glass-section-nav",
        compact ? "msqdx-glass-section-nav--compact" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={navLabel ?? "Section navigation"}
    >
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
    </nav>
  );
}
