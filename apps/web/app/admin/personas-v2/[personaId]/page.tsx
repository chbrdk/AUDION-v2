import { redirect } from "next/navigation";
import { ADMIN_ROUTES } from "../../../../lib/routes";
import { PERSONA_V2_DEFAULT_SECTION } from "../../../../lib/persona-v2-sections";

type PersonaV2DetailIndexPageProps = {
  params: Promise<{ personaId: string }>;
};

export default async function PersonaV2DetailIndexPage({ params }: PersonaV2DetailIndexPageProps) {
  const { personaId } = await params;
  redirect(ADMIN_ROUTES.personaV2Section(personaId, PERSONA_V2_DEFAULT_SECTION));
}
