import type { ReactNode } from "react";

export type SectionNavItem = {
  id: string;
  href: string;
  label: string;
  description?: string;
  icon?: string;
};

export type MsqdxGlassSectionShellProps = {
  children: ReactNode;
  /** e.g. "Personas" */
  scopeLabel?: string;
  entityTitle?: string;
  entitySubtitle?: string;
  backHref?: string;
  backLabel?: string;
  headerActions?: ReactNode;
  /** Decorative MsqdxCornerBox top-right; 36px radius; with accent, `entity-main` + patch live in `__entity-hero` inside the workspace dock */
  entityCornerAccent?: boolean;
  navItems?: SectionNavItem[];
  /** Accessible label for the sub-nav `<nav>` */
  navLabel?: string;
  activeSectionId?: string;
  /** Section heading inside workspace (current route) */
  sectionTitle?: string;
  sectionDescription?: string;
  workspaceActions?: ReactNode;
  /** Overview/list pages without sub-nav rail */
  hideSubNav?: boolean;
  /** Allow full-width section content (e.g. moodboard grid) */
  wideContent?: boolean;
  className?: string;
};
