import { redirect } from "next/navigation";
import { ADMIN_ROUTES } from "../../../../lib/routes";
import { TARGET_GROUP_V2_DEFAULT_SECTION } from "../../../../lib/target-group-v2-sections";

type TargetGroupV2DetailIndexPageProps = {
  params: Promise<{ targetGroupId: string }>;
};

export default async function TargetGroupV2DetailIndexPage({ params }: TargetGroupV2DetailIndexPageProps) {
  const { targetGroupId } = await params;
  redirect(ADMIN_ROUTES.targetGroupV2Section(targetGroupId, TARGET_GROUP_V2_DEFAULT_SECTION));
}
