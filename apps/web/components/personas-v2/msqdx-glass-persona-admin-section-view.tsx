"use client";

import { MsqdxGlassPersonaAdminPanel } from "../msqdx-glass-persona-admin-panel";
import type { PersonaV2SectionId } from "../../lib/persona-v2-sections";

export type MsqdxGlassPersonaAdminSectionViewProps = {
  personaId: string;
  sectionId: PersonaV2SectionId;
  docsUrl: string;
};

/** Renders one persona v2 section using the shared admin panel (v1 logic, flat layout). */
export function MsqdxGlassPersonaAdminSectionView({
  personaId,
  sectionId,
  docsUrl,
}: MsqdxGlassPersonaAdminSectionViewProps) {
  return (
    <MsqdxGlassPersonaAdminPanel
      initialList={{ items: [], total: 0, page: 1, page_size: 50 }}
      docsUrl={docsUrl}
      mode="detail"
      activePersonaId={personaId}
      presentation="v2-section"
      visibleSection={sectionId}
    />
  );
}
