export const dynamic = "force-dynamic";

import { MsqdxGlassProjectAdminPanel } from "../../../../components/msqdx-glass-project-admin-panel";

export default async function AdminProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  // In detail mode we don't need SSR project list; ProjectProvider + detail fetch will populate UI.
  return (
    <MsqdxGlassProjectAdminPanel
      initialProjects={[]}
      activeProjectId={projectId}
      mode="detail"
    />
  );
}

