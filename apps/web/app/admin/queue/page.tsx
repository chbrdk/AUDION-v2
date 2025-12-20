import type { QueueStatsResponse } from "@msqdx-glass/types";

import { getPersonaBackendBase } from "../../api/_lib/backend";
import { MsqdxGlassQueueDashboard } from "../../../components/msqdx-glass-queue-dashboard";

export const dynamic = "force-dynamic";

async function fetchQueueStats(): Promise<QueueStatsResponse> {
  const internalUrl = process.env.NEXT_PERSONA_BACKEND_INTERNAL_URL?.trim();
  const base = internalUrl || getPersonaBackendBase({ preferPublic: false });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${base}/queue/stats`, {
      cache: "no-store",
      signal: controller.signal,
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
  let stats: QueueStatsResponse;
  let error: string | null = null;

  try {
    stats = await fetchQueueStats();
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
          <strong>Backend unreachable:</strong> {error}. Please wait until the service
          has fully started and reload the page.
        </div>
      )}
      <MsqdxGlassQueueDashboard initialStats={stats} />
    </>
  );
}


