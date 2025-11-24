"use client";

import type { ReactNode } from "react";

export type UdgGlassDashboardCardSectionProps = {
  title?: string;
  children: ReactNode;
};

export const UdgGlassDashboardCardSection = ({
  title,
  children
}: UdgGlassDashboardCardSectionProps) => {
  return (
    <div className="udg-glass-dashboard-card-section">
      {title && <h4>{title}</h4>}
      {children}
    </div>
  );
};

