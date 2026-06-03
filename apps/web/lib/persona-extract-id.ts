/** Extract persona id from API create/generate responses (camelCase or snake_case). */
export function extractPersonaId(payload: unknown): string | null {
  const anyPayload = payload as Record<string, unknown> | null;
  if (!anyPayload) return null;
  const metadata = anyPayload.metadata as Record<string, unknown> | undefined;
  const profile = anyPayload.profile as Record<string, unknown> | undefined;
  return (
    (metadata?.personaId as string | undefined) ??
    (metadata?.persona_id as string | undefined) ??
    (profile?.id as string | undefined) ??
    (anyPayload.id as string | undefined) ??
    null
  );
}
