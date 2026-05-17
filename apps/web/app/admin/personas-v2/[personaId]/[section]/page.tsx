import { notFound } from "next/navigation";
import { getPersonaBackendDocsUrl } from "../../../../api/_lib/backend";
import { MsqdxGlassPersonaV2DetailLayout } from "../../../../../components/personas-v2/msqdx-glass-persona-v2-detail-layout";
import { isPersonaV2SectionId, type PersonaV2SectionId } from "../../../../../lib/persona-v2-sections";

type PersonaV2SectionPageProps = {
  params: Promise<{ personaId: string; section: string }>;
};

export default async function PersonaV2SectionPage({ params }: PersonaV2SectionPageProps) {
  const { personaId, section } = await params;
  const docsUrl = getPersonaBackendDocsUrl();

  if (!isPersonaV2SectionId(section)) {
    notFound();
  }

  return (
    <MsqdxGlassPersonaV2DetailLayout
      personaId={personaId}
      sectionId={section as PersonaV2SectionId}
      docsUrl={docsUrl}
    />
  );
}
