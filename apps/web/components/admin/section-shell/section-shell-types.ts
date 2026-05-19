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
  /** In-page back link. Persona v2 + corner hero: duplicate hidden from `md` via CSS (header slot shows there). */
  backHref?: string;
  backLabel?: string;
  headerActions?: ReactNode;
  /** Entity copy sits inside the black `MsqdxCornerBox` (36px radius, aligned with workspace frame). */
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
