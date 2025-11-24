import type { QueueStatsResponse, PersonaListResponse, TargetGroupListResponse } from "@udg-glass/types";
import { getPersonaBackendBase } from "../api/_lib/backend";
import { UdgGlassAdminDashboard } from "../../components/admin/udg-glass-admin-dashboard";

export const dynamic = "force-dynamic";

async function fetchPersonaList(): Promise<PersonaListResponse> {
  const internalUrl = process.env.NEXT_PERSONA_BACKEND_INTERNAL_URL?.trim();
  const base = internalUrl || getPersonaBackendBase({ preferPublic: false });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${base}/personas?page=1&page_size=1`, {
      cache: "no-store",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Persona backend unavailable (${response.status}): ${detail}`);
    }

    return (await response.json()) as PersonaListResponse;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Persona backend request timeout: ${base}`);
    }
    if (error instanceof Error && error.message.includes("ECONNREFUSED")) {
      throw new Error(`Persona backend unreachable at ${base}. Is the service running?`);
    }
    throw error;
  }
}

async function fetchTargetGroupList(): Promise<TargetGroupListResponse> {
  const internalUrl = process.env.NEXT_PERSONA_BACKEND_INTERNAL_URL?.trim();
  const base = internalUrl || getPersonaBackendBase({ preferPublic: false });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${base}/target-groups?page=1&page_size=1`, {
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

export default async function AdminDashboardPage() {
  let personaStats = { total: 0 };
  let targetGroupStats = { total: 0 };
  let queueStats: QueueStatsResponse = {
    pendingCount: 0,
    processingCount: 0,
    completedCount: 0,
    failedCount: 0,
    workerAvailable: false,
    workerCount: 0,
  };
  let error: string | null = null;

  try {
    const [personaResponse, targetGroupResponse, queueResponse] = await Promise.allSettled([
      fetchPersonaList(),
      fetchTargetGroupList(),
      fetchQueueStats(),
    ]);

    if (personaResponse.status === "fulfilled") {
      personaStats = { total: personaResponse.value.total };
    } else {
      console.error("Failed to fetch personas:", personaResponse.reason);
    }

    if (targetGroupResponse.status === "fulfilled") {
      targetGroupStats = { total: targetGroupResponse.value.total };
    } else {
      console.error("Failed to fetch target groups:", targetGroupResponse.reason);
    }

    if (queueResponse.status === "fulfilled") {
      queueStats = queueResponse.value;
    } else {
      console.error("Failed to fetch queue stats:", queueResponse.reason);
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "Unknown error";
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
      <UdgGlassAdminDashboard
        personaStats={personaStats}
        targetGroupStats={targetGroupStats}
        queueStats={queueStats}
      />
    </>
  );
}


