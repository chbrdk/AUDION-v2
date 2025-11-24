import type {
  CeleryTaskStatus,
  ProcessingJobDetailResponse,
  ProcessingJobListResponse,
  QueueStatsResponse,
} from "@udg-glass/types";

import { buildPersonaBackendUrl, forwardPersonaBackend } from "./persona";

type FetchProcessingJobsParams = {
  status?: string;
  documentId?: string;
  page?: number;
  pageSize?: number;
  dateFrom?: string;
  dateTo?: string;
};

export async function fetchProcessingJobs(
  params: FetchProcessingJobsParams = {}
): Promise<ProcessingJobListResponse> {
  const searchParams = new URLSearchParams();
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

  const response = await forwardPersonaBackend(`/queue/jobs?${searchParams.toString()}`, {
    method: "GET",
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
  jobId: string
): Promise<ProcessingJobDetailResponse> {
  const response = await forwardPersonaBackend(`/queue/jobs/${jobId}`, {
    method: "GET",
  });
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
  jobId: string
): Promise<CeleryTaskStatus> {
  const response = await forwardPersonaBackend(`/queue/jobs/${jobId}/task`, {
    method: "GET",
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

export async function fetchQueueStats(): Promise<QueueStatsResponse> {
  const response = await forwardPersonaBackend("/queue/stats", {
    method: "GET",
  });
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

export async function retryJob(jobId: string): Promise<ProcessingJobDetailResponse> {
  const response = await forwardPersonaBackend(`/queue/jobs/${jobId}/retry`, {
    method: "POST",
  });
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

