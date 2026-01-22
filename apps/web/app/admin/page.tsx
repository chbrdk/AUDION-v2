export const dynamic = "force-dynamic";

import type { QueueStatsResponse, PersonaListResponse, ServiceStatusResponse, TargetGroupListResponse } from "@msqdx-glass/types";
import { MsqdxGlassAdminDashboard } from "../../components/admin/msqdx-glass-admin-dashboard";

async function fetchPersonaList(): Promise<PersonaListResponse> {
  // Use absolute URL for server-side fetch
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '/audion';
  const apiUrl = `http://localhost:3005${basePath}/api/personas?page=1&page_size=1`;

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
      throw new Error(`Persona backend unavailable (${response.status}): ${detail}`);
    }

    return (await response.json()) as PersonaListResponse;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Persona backend request timeout: ${apiUrl}`);
    }
    if (error instanceof Error && error.message.includes("ECONNREFUSED")) {
      throw new Error(`Persona backend unreachable at ${apiUrl}. Is the service running?`);
    }
    throw error;
  }
}

async function fetchTargetGroupList(): Promise<TargetGroupListResponse> {
  // Use absolute URL for server-side fetch
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '/audion';
  const apiUrl = `http://localhost:3005${basePath}/api/target-groups?page=1&page_size=1`;

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

async function fetchQueueStats(): Promise<QueueStatsResponse> {
  // Use absolute URL for server-side fetch
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '/audion';
  const apiUrl = `http://localhost:3005${basePath}/api/queue/stats`;

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
      throw new Error(`Queue backend unavailable (${response.status}): ${detail}`);
    }

    return (await response.json()) as QueueStatsResponse;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Queue backend request timeout: ${apiUrl}`);
    }
    if (error instanceof Error && error.message.includes("ECONNREFUSED")) {
      throw new Error(`Queue backend unreachable at ${apiUrl}. Is the service running?`);
    }
    throw error;
  }
}

async function fetchServiceStatus(): Promise<ServiceStatusResponse | null> {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '/audion';
  const apiUrl = `http://localhost:3005${basePath}/api/persona-backend/health`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(apiUrl, {
      cache: "no-store",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Don't throw, just return null if service status is unavailable
      return null;
    }

    return (await response.json()) as ServiceStatusResponse;
  } catch (error) {
    clearTimeout(timeoutId);
    // Return null on any error - service status is optional
    return null;
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
  let serviceStatus: ServiceStatusResponse | null = null;
  let error: string | null = null;

  try {
    const [personaResponse, targetGroupResponse, queueResponse, serviceStatusResponse] = await Promise.allSettled([
      fetchPersonaList(),
      fetchTargetGroupList(),
      fetchQueueStats(),
      fetchServiceStatus(),
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

    if (serviceStatusResponse.status === "fulfilled" && serviceStatusResponse.value) {
      serviceStatus = serviceStatusResponse.value;
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
      <MsqdxGlassAdminDashboard
        personaStats={personaStats}
        targetGroupStats={targetGroupStats}
        queueStats={queueStats}
        serviceStatus={serviceStatus}
      />
    </>
  );
}


