import { notFound, redirect } from "next/navigation";
import { getPersonaBackendDocsUrl } from "../../../../api/_lib/backend";
import { ADMIN_ROUTES } from "../../../../../lib/routes";
import { MsqdxGlassTargetGroupV2DetailLayout } from "../../../../../components/target-groups-v2/msqdx-glass-target-group-v2-detail-layout";
import {
  resolveTargetGroupV2SectionId,
  type TargetGroupV2SectionId,
} from "../../../../../lib/target-group-v2-sections";

type TargetGroupV2SectionPageProps = {
  params: Promise<{ targetGroupId: string; section: string }>;
};

export default async function TargetGroupV2SectionPage({ params }: TargetGroupV2SectionPageProps) {
  const { targetGroupId, section } = await params;
  const docsUrl = getPersonaBackendDocsUrl();

  const sectionId = resolveTargetGroupV2SectionId(section);
  if (!sectionId) {
    notFound();
  }

  if (section !== sectionId) {
    redirect(ADMIN_ROUTES.targetGroupV2Section(targetGroupId, sectionId));
  }

  return (
    <MsqdxGlassTargetGroupV2DetailLayout
      targetGroupId={targetGroupId}
      sectionId={sectionId as TargetGroupV2SectionId}
      docsUrl={docsUrl}
    />
  );
}
