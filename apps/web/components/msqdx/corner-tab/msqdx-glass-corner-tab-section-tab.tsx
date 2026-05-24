"use client";

import {
  MsqdxCornerTabSectionTab,
  type MsqdxCornerTabSectionTabProps,
} from "@msqdx/react";

export type MsqdxGlassCornerTabSectionTabProps = MsqdxCornerTabSectionTabProps;

/**
 * AUDION alias for {@link MsqdxCornerTabSectionTab}.
 */
export function MsqdxGlassCornerTabSectionTab({
  className,
  headingClassName,
  actionsClassName,
  ...props
}: MsqdxGlassCornerTabSectionTabProps) {
  return (
    <MsqdxCornerTabSectionTab
      {...props}
      className={["msqdx-glass-corner-tab-section__tab-content", className]
        .filter(Boolean)
        .join(" ")}
      headingClassName={["msqdx-glass-corner-tab-section__tab-heading", headingClassName]
        .filter(Boolean)
        .join(" ")}
      actionsClassName={["msqdx-glass-corner-tab-section__tab-actions", actionsClassName]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
