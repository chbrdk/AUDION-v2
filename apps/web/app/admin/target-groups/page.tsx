import type { TargetGroupListResponse } from "@msqdx-glass/types";

import { getPersonaBackendBase, getPersonaBackendDocsUrl } from "../../api/_lib/backend";
import { MsqdxGlassTargetGroupAdminPanel } from "../../../components/msqdx-glass-target-group-admin-panel";

export const dynamic = "force-dynamic";

async function fetchTargetGroupList(): Promise<TargetGroupListResponse> {
  const internalUrl = process.env.NEXT_PERSONA_BACKEND_INTERNAL_URL?.trim();
  const base = internalUrl || getPersonaBackendBase({ preferPublic: false });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${base}/target-groups?page=1&page_size=50`, {
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
      throw new Error(`Target Group backend request timeout: ${base}`);
    }
    if (error instanceof Error && error.message.includes("ECONNREFUSED")) {
      throw new Error(`Target Group backend unreachable at ${base}. Is the service running?`);
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


