export const dynamic = "force-dynamic";

import type { QueueStatsResponse } from "@msqdx-glass/types";

import { getPersonaBackendBase } from "../../api/_lib/backend";
import { buildAuthHeaders, getServerAuthToken, getServerProjectId } from "../../api/_lib/auth";
import { MsqdxGlassQueueDashboard } from "../../../components/msqdx-glass-queue-dashboard";
import { getServerT } from "../../../lib/i18n/server";

async function fetchQueueStats(projectId: string, headers: HeadersInit): Promise<QueueStatsResponse> {
  const base = getPersonaBackendBase({ preferPublic: false });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${base}/queue/stats?project_id=${projectId}`, {
      cache: "no-store",
      signal: controller.signal,
      headers,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Queue backend unavailable (${response.status}): ${detail}`);
    }

    return (await response.json()) as QueueStatsResponse;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Queue backend request timeout: ${base}`);
    }
    if (error instanceof Error && error.message.includes("ECONNREFUSED")) {
      throw new Error(`Queue backend unreachable at ${base}. Is the service running?`);
    }
    throw error;
  }
}

export default async function QueuePage() {
  const t = await getServerT();
  let stats: QueueStatsResponse;
  let error: string | null = null;
  const projectId = await getServerProjectId();
  const headers = buildAuthHeaders(await getServerAuthToken());

  try {
    if (!projectId) {
      throw new Error(t("queue.selectProject"));
    }
    stats = await fetchQueueStats(projectId, headers);
  } catch (err) {
    error = err instanceof Error ? err.message : "Unknown error";
    stats = {
      pendingCount: 0,
      processingCount: 0,
      completedCount: 0,
      failedCount: 0,
      workerAvailable: false,
      workerCount: 0,
    };
  }

  return (
    <>
      {error && (
        <div
          style={{
            padding: "1rem",
            marginBottom: "1rem",
            backgroundColor: "var(--color-secondary-dx-pink-tint)",
            borderRadius: "8px",
            color: "var(--color-secondary-dx-pink-on-light)",
          }}
        >
          <strong>{t("queueBackend.errorTitle")}</strong> {error}. {t("queueBackend.errorBody")}
        </div>
      )}
      <MsqdxGlassQueueDashboard initialStats={stats} />
    </>
  );
}
