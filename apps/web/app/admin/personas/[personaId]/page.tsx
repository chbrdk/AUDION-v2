export const dynamic = "force-dynamic";

import { getPersonaBackendDocsUrl } from "../../../api/_lib/backend";
import { MsqdxGlassPersonaAdminPanel } from "../../../../components/msqdx-glass-persona-admin-panel";

type AdminPersonaDetailPageProps = {
  params: Promise<{ personaId: string }>;
};

export default async function AdminPersonaDetailPage({ params }: AdminPersonaDetailPageProps) {
  const { personaId } = await params;
  const docsUrl = getPersonaBackendDocsUrl();

  return (
    <MsqdxGlassPersonaAdminPanel
      initialList={{ items: [], total: 0, page: 1, page_size: 50 }}
      docsUrl={docsUrl}
      mode="detail"
      activePersonaId={personaId}
    />
  );
}

