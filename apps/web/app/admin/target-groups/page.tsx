export const dynamic = "force-dynamic";

import type { TargetGroupListResponse } from "@msqdx-glass/types";

import { getPersonaBackendBase, getPersonaBackendDocsUrl } from "../../api/_lib/backend";
import { buildAuthHeaders, getServerAuthToken, getServerProjectId } from "../../api/_lib/auth";
import { MsqdxGlassTargetGroupAdminPanel } from "../../../components/msqdx-glass-target-group-admin-panel";
import { getServerT } from "../../../lib/i18n/server";

async function fetchTargetGroupList(projectId: string, headers: HeadersInit): Promise<TargetGroupListResponse> {
  const apiUrl = `${getPersonaBackendBase({ preferPublic: false })}/target-groups?page=1&page_size=50&project_id=${projectId}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(apiUrl, {
      cache: "no-store",
      signal: controller.signal,
      headers,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Target Group backend unavailable (${response.status}): ${detail}`);
    }

    return (await response.json()) as TargetGroupListResponse;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Target Group backend request timeout: ${apiUrl}`);
    }
    if (error instanceof Error && error.message.includes("ECONNREFUSED")) {
      throw new Error(`Target Group backend unreachable at ${apiUrl}. Is the service running?`);
    }
    throw error;
  }
}

export default async function TargetGroupAdminPage() {
  const t = await getServerT();
  let list: TargetGroupListResponse;
  let error: string | null = null;
  const projectId = await getServerProjectId();
  const headers = buildAuthHeaders(await getServerAuthToken());

  try {
    if (!projectId) {
      throw new Error(t("backend.selectProject"));
    }
    list = await fetchTargetGroupList(projectId, headers);
  } catch (err) {
    error = err instanceof Error ? err.message : "Unknown error";
    list = { items: [], total: 0, page: 1, page_size: 50 };
  }

  const docsUrl = getPersonaBackendDocsUrl();

  return (
    <>
      {error && (
        <div style={{ padding: "1rem", marginBottom: "1rem", backgroundColor: "var(--color-secondary-dx-pink-tint)", borderRadius: "8px", color: "var(--color-secondary-dx-pink-on-light)" }}>
          <strong>{t("backend.errorTitle")}</strong> {error}. {t("backend.errorBody")}
        </div>
      )}
      <MsqdxGlassTargetGroupAdminPanel initialList={list} docsUrl={docsUrl} />
    </>
  );
}
