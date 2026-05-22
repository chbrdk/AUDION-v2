import { notFound, redirect } from "next/navigation";
import { getPersonaBackendDocsUrl } from "../../../../api/_lib/backend";
import { ADMIN_ROUTES } from "../../../../../lib/routes";
import { MsqdxGlassPersonaV2DetailLayout } from "../../../../../components/personas-v2/msqdx-glass-persona-v2-detail-layout";
import { resolvePersonaV2SectionId, type PersonaV2SectionId } from "../../../../../lib/persona-v2-sections";

type PersonaV2SectionPageProps = {
  params: Promise<{ personaId: string; section: string }>;
};

export default async function PersonaV2SectionPage({ params }: PersonaV2SectionPageProps) {
  const { personaId, section } = await params;
  const docsUrl = getPersonaBackendDocsUrl();

  const sectionId = resolvePersonaV2SectionId(section);
  if (!sectionId) {
    notFound();
  }

  if (section !== sectionId) {
    redirect(ADMIN_ROUTES.personaV2Section(personaId, sectionId));
  }

  return (
    <MsqdxGlassPersonaV2DetailLayout
      personaId={personaId}
      sectionId={sectionId}
      docsUrl={docsUrl}
    />
  );
}
