export const dynamic = "force-dynamic";

import { getPersonaBackendDocsUrl } from "../../../api/_lib/backend";
import { MsqdxGlassTargetGroupAdminPanel } from "../../../../components/msqdx-glass-target-group-admin-panel";

type AdminTargetGroupDetailPageProps = {
  params: Promise<{ targetGroupId: string }>;
};

export default async function AdminTargetGroupDetailPage({ params }: AdminTargetGroupDetailPageProps) {
  const { targetGroupId } = await params;
  const docsUrl = getPersonaBackendDocsUrl();

  return (
    <MsqdxGlassTargetGroupAdminPanel
      initialList={{ items: [], total: 0, page: 1, page_size: 50 }}
      docsUrl={docsUrl}
      mode="detail"
      activeTargetGroupId={targetGroupId}
    />
  );
}

