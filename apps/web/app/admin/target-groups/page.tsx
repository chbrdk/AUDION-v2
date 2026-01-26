export const dynamic = "force-dynamic";

import type { TargetGroupListResponse } from "@msqdx-glass/types";

import { getPersonaBackendDocsUrl } from "../../api/_lib/backend";
import { MsqdxGlassTargetGroupAdminPanel } from "../../../components/msqdx-glass-target-group-admin-panel";

async function fetchTargetGroupList(): Promise<TargetGroupListResponse> {
  // Use absolute URL for server-side fetch
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  const apiUrl = `http://localhost:3005${basePath}/api/target-groups?page=1&page_size=50`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(apiUrl, {
      cache: "no-store",
      signal: controller.signal,
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
  let list: TargetGroupListResponse;
  let error: string | null = null;

  try {
    list = await fetchTargetGroupList();
  } catch (err) {
    error = err instanceof Error ? err.message : "Unknown error";
    list = { items: [], total: 0, page: 1, page_size: 50 };
  }

  const docsUrl = getPersonaBackendDocsUrl();

  return (
    <>
      {error && (
        <div style={{ padding: "1rem", marginBottom: "1rem", backgroundColor: "var(--color-secondary-dx-pink-tint)", borderRadius: "8px", color: "var(--color-secondary-dx-pink-on-light)" }}>
          <strong>Backend unreachable:</strong> {error}. Please wait until the service has fully started and reload the page.
        </div>
      )}
      <MsqdxGlassTargetGroupAdminPanel initialList={list} docsUrl={docsUrl} />
    </>
  );
}


