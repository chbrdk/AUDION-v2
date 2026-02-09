export const dynamic = "force-dynamic";

import type { QueueStatsResponse, PersonaListResponse, ServiceStatusResponse, TargetGroupListResponse } from "@msqdx-glass/types";
import { MsqdxGlassAdminDashboard } from "../../components/admin/msqdx-glass-admin-dashboard";
import { getPersonaBackendBase } from "../api/_lib/backend";
import { buildAuthHeaders, getServerAuthToken, getServerProjectId } from "../api/_lib/auth";

async function fetchPersonaList(projectId: string, headers: HeadersInit): Promise<PersonaListResponse> {
  const apiUrl = `${getPersonaBackendBase({ preferPublic: false })}/personas?page=1&page_size=1&project_id=${projectId}`;

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

async function fetchTargetGroupList(projectId: string, headers: HeadersInit): Promise<TargetGroupListResponse> {
  const apiUrl = `${getPersonaBackendBase({ preferPublic: false })}/target-groups?page=1&page_size=1&project_id=${projectId}`;

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

async function fetchQueueStats(projectId: string, headers: HeadersInit): Promise<QueueStatsResponse> {
  const apiUrl = `${getPersonaBackendBase({ preferPublic: false })}/queue/stats?project_id=${projectId}`;

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
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
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
  const projectId = await getServerProjectId();
  const headers = buildAuthHeaders(await getServerAuthToken());

  try {
    if (!projectId) {
      error = "Select a project to load dashboard statistics.";
    } else {
      const [personaResponse, targetGroupResponse, queueResponse, serviceStatusResponse] = await Promise.allSettled([
        fetchPersonaList(projectId, headers),
        fetchTargetGroupList(projectId, headers),
        fetchQueueStats(projectId, headers),
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
