"use client";

import type { ReactNode } from "react";

export type MsqdxGlassDashboardCardSectionProps = {
  title?: string;
  children: ReactNode;
};

export const MsqdxGlassDashboardCardSection = ({
  title,
  children
}: MsqdxGlassDashboardCardSectionProps) => {
  return (
    <div className="msqdx-glass-dashboard-card-section">
      {title && <h4>{title}</h4>}
      {children}
    </div>
  );
};

