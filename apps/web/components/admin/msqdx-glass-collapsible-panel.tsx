"use client";

import { MsqdxCollapsiblePanel } from "@msqdx/react";
import type { MsqdxCollapsiblePanelProps } from "@msqdx/react";
import { useAdminPanel } from "./msqdx-glass-admin-layout";

export type MsqdxGlassCollapsiblePanelProps = MsqdxCollapsiblePanelProps;

/** Wrapper around DS MsqdxCollapsiblePanel that wires AdminPanel context for mobile off-canvas. */
export const MsqdxGlassCollapsiblePanel = ({
  children,
  title,
  defaultExpanded = true,
  ...rest
}: MsqdxGlassCollapsiblePanelProps) => {
  const { panelOpen, setPanelOpen } = useAdminPanel();

  return (
    <MsqdxCollapsiblePanel
      title={title}
      defaultExpanded={defaultExpanded}
      mobileOpen={panelOpen}
      onMobileClose={() => setPanelOpen(false)}
      {...rest}
    >
      {children}
    </MsqdxCollapsiblePanel>
  );
};
