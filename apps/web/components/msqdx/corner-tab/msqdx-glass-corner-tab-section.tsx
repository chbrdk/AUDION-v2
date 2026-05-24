"use client";

import {
  MsqdxCornerTabSection,
  type MsqdxCornerTabSectionPlacement,
  type MsqdxCornerTabSectionProps,
} from "@msqdx/react";

export type MsqdxGlassCornerTabSectionPlacement = MsqdxCornerTabSectionPlacement;

export type MsqdxGlassCornerTabSectionProps = Omit<MsqdxCornerTabSectionProps, "className"> & {
  className?: string;
};

/**
 * AUDION glass-styled {@link MsqdxCornerTabSection} (cutout corner tab, no slider).
 * App CSS targets `.msqdx-glass-corner-tab-section` (see `msqdx-glass-corner-tab-section.css`).
 */
export function MsqdxGlassCornerTabSection({
  className,
  ...props
}: MsqdxGlassCornerTabSectionProps) {
  return (
    <MsqdxCornerTabSection
      {...props}
      className={["msqdx-glass-corner-tab-section", className].filter(Boolean).join(" ")}
    />
  );
}
