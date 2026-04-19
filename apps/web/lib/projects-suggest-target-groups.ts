import { buildApiUrl } from "../app/api/_lib/backend";

export type TargetGroupSuggestionDto = {
  name: string;
  segment: string;
  description: string;
  name_de?: string | null;
  segment_de?: string | null;
  description_de?: string | null;
};

export type SuggestTargetGroupsResponse = {
  suggestions: TargetGroupSuggestionDto[];
};

/**
 * POST /projects/{projectId}/suggest-target-groups — optional `bilingual` asks the API for EN + DE fields per suggestion.
 */
export async function suggestProjectTargetGroups(
  projectId: string,
  options: { maxSuggestions?: number; bilingual?: boolean } = {}
): Promise<SuggestTargetGroupsResponse> {
  const max = options.maxSuggestions ?? 5;
  const body: Record<string, unknown> = {
    max_suggestions: Math.min(Math.max(1, max), 10),
  };
  if (options.bilingual) {
    body.bilingual = true;
  }
  const res = await fetch(
    buildApiUrl(`/api/projects/${encodeURIComponent(projectId)}/suggest-target-groups`),
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(detail || `suggest-target-groups failed (${res.status})`);
  }
  return (await res.json()) as SuggestTargetGroupsResponse;
}
