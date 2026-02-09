import type {
  CeleryTaskStatus,
  ProcessingJobDetailResponse,
  ProcessingJobListResponse,
  QueueStatsResponse,
} from "@msqdx-glass/types";

import { buildApiUrl } from "./backend";

type FetchProcessingJobsParams = {
  projectId?: string;
  status?: string;
  documentId?: string;
  page?: number;
  pageSize?: number;
  dateFrom?: string;
  dateTo?: string;
};

const buildQueueUrl = (path: string, params?: URLSearchParams) => {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const base = buildApiUrl(`/api/queue${normalized}`);
  const query = params?.toString();
  return query ? `${base}?${query}` : base;
};

export async function fetchProcessingJobs(
  params: FetchProcessingJobsParams = {}
): Promise<ProcessingJobListResponse> {
  if (!params.projectId) {
    throw new Error("Project selection is required.");
  }
  const searchParams = new URLSearchParams();
  searchParams.append("project_id", params.projectId);
  if (params.status) {
    searchParams.append("status", params.status);
  }
  if (params.documentId) {
    searchParams.append("document_id", params.documentId);
  }
  if (params.page) {
    searchParams.append("page", params.page.toString());
  }
  if (params.pageSize) {
    searchParams.append("page_size", params.pageSize.toString());
  }
  if (params.dateFrom) {
    searchParams.append("date_from", params.dateFrom);
  }
  if (params.dateTo) {
    searchParams.append("date_to", params.dateTo);
  }

  const response = await fetch(buildQueueUrl("/jobs", searchParams), {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch processing jobs: ${response.status}`);
  }
  const data = (await response.json()) as ProcessingJobListResponse;
  // Transform snake_case to camelCase for frontend
  return {
    items: data.items.map((item) => ({
      id: item.id,
      documentId: (item as any).document_id,
      status: item.status,
      progress: item.progress,
      error: item.error,
      createdAt: (item as any).created_at,
      updatedAt: (item as any).updated_at,
    })),
    total: data.total,
    page: data.page,
    page_size: data.page_size,
  };
}

export async function fetchProcessingJob(
  jobId: string,
  projectId: string
): Promise<ProcessingJobDetailResponse> {
  const params = new URLSearchParams({ project_id: projectId });
  const response = await fetch(buildQueueUrl(`/jobs/${jobId}`, params), { method: "GET", cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch processing job: ${response.status}`);
  }
  const data = (await response.json()) as any;
  return {
    id: data.id,
    documentId: data.document_id,
    documentFilename: data.document_filename,
    documentSizeBytes: data.document_size_bytes,
    status: data.status,
    progress: data.progress,
    error: data.error,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    celeryTaskId: data.celery_task_id,
  };
}

export async function fetchCeleryTaskStatus(
  jobId: string,
  projectId: string
): Promise<CeleryTaskStatus> {
  const params = new URLSearchParams({ project_id: projectId });
  const response = await fetch(buildQueueUrl(`/jobs/${jobId}/task`, params), {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch celery task status: ${response.status}`);
  }
  const data = (await response.json()) as any;
  return {
    taskId: data.task_id,
    status: data.status,
    result: data.result,
    error: data.error,
    traceback: data.traceback,
    startedAt: data.started_at,
    completedAt: data.completed_at,
  };
}

export async function fetchQueueStats(projectId: string): Promise<QueueStatsResponse> {
  const params = new URLSearchParams({ project_id: projectId });
  const response = await fetch(buildQueueUrl("/stats", params), { method: "GET", cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch queue stats: ${response.status}`);
  }
  const data = (await response.json()) as any;
  return {
    pendingCount: data.pending_count,
    processingCount: data.processing_count,
    completedCount: data.completed_count,
    failedCount: data.failed_count,
    workerAvailable: data.worker_available,
    workerCount: data.worker_count,
  };
}

export async function retryJob(jobId: string, projectId: string): Promise<ProcessingJobDetailResponse> {
  const params = new URLSearchParams({ project_id: projectId, job_id: jobId });
  const response = await fetch(buildQueueUrl("/jobs", params), { method: "POST", cache: "no-store" });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to retry job: ${response.status} - ${errorText}`);
  }
  const data = (await response.json()) as any;
  return {
    id: data.id,
    documentId: data.document_id,
    documentFilename: data.document_filename,
    documentSizeBytes: data.document_size_bytes,
    status: data.status,
    progress: data.progress,
    error: data.error,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    celeryTaskId: data.celery_task_id,
  };
}
