"use client";

import { MsqdxGlassPersonaAdminSectionView } from "./msqdx-glass-persona-admin-section-view";
import type { PersonaV2SectionId } from "../../lib/persona-v2-sections";

export type MsqdxGlassPersonaV2SectionContentProps = {
  personaId: string;
  sectionId: PersonaV2SectionId;
  personaName?: string;
  docsUrl: string;
};

export function MsqdxGlassPersonaV2SectionContent({
  personaId,
  sectionId,
  docsUrl,
}: MsqdxGlassPersonaV2SectionContentProps) {
  return <MsqdxGlassPersonaAdminSectionView personaId={personaId} sectionId={sectionId} docsUrl={docsUrl} />;
}
