import type {
  PersonaDocument,
  PersonaListResponse,
  PersonaResponse,
  TargetGroup,
  TargetGroupKnowledgeEntry,
  TargetGroupListResponse,
  TargetGroupResponse,
  KnowledgeChunk,
  ClusterResult,
  SimilarChunk,
} from "@udg-glass/types";

// Re-export PersonaResponse for use in other modules
export type { PersonaResponse };

import { buildPersonaBackendUrl, forwardPersonaBackend } from "./persona";

type TargetGroupCreateRequest = {
  project_id: string;
  name: string;
  segment: string;
  description?: string | null;
};

type TargetGroupUpdateRequest = {
  name?: string;
  segment?: string;
  description?: string | null;
  updated_by?: string;
};

type TargetGroupKnowledgeUpsertRequest = {
  title: string;
  content: string;
  metadata?: Record<string, any> | null;
  created_by?: string;
};

export async function fetchTargetGroupList(
  projectId?: string,
  page: number = 1,
  pageSize: number = 20
): Promise<TargetGroupListResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    page_size: pageSize.toString(),
  });
  if (projectId) {
    params.append("project_id", projectId);
  }
  const response = await forwardPersonaBackend(`/target-groups?${params.toString()}`, {
    method: "GET",
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch target groups: ${response.status}`);
  }
  return (await response.json()) as TargetGroupListResponse;
}

export async function fetchTargetGroup(targetGroupId: string): Promise<TargetGroupResponse> {
  const response = await forwardPersonaBackend(`/target-groups/${targetGroupId}`, {
    method: "GET",
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch target group: ${response.status}`);
  }
  return (await response.json()) as TargetGroupResponse;
}

export async function createTargetGroup(
  payload: TargetGroupCreateRequest
): Promise<TargetGroupResponse> {
  const response = await forwardPersonaBackend("/target-groups", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create target group: ${response.status} - ${errorText}`);
  }
  return (await response.json()) as TargetGroupResponse;
}

export async function updateTargetGroup(
  targetGroupId: string,
  payload: TargetGroupUpdateRequest
): Promise<TargetGroupResponse> {
  const response = await forwardPersonaBackend(`/target-groups/${targetGroupId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update target group: ${response.status} - ${errorText}`);
  }
  return (await response.json()) as TargetGroupResponse;
}

export async function fetchTargetGroupKnowledge(
  targetGroupId: string
): Promise<TargetGroupKnowledgeEntry[]> {
  const response = await forwardPersonaBackend(`/target-groups/${targetGroupId}/knowledge`, {
    method: "GET",
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch target group knowledge: ${response.status}`);
  }
  return (await response.json()) as TargetGroupKnowledgeEntry[];
}

export async function createTargetGroupKnowledge(
  targetGroupId: string,
  payload: TargetGroupKnowledgeUpsertRequest
): Promise<TargetGroupKnowledgeEntry> {
  const response = await forwardPersonaBackend(`/target-groups/${targetGroupId}/knowledge`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create target group knowledge: ${response.status} - ${errorText}`);
  }
  return (await response.json()) as TargetGroupKnowledgeEntry;
}

export async function deleteTargetGroupKnowledge(
  targetGroupId: string,
  knowledgeId: string
): Promise<void> {
  const response = await forwardPersonaBackend(
    `/target-groups/${targetGroupId}/knowledge/${knowledgeId}`,
    {
      method: "DELETE",
    }
  );
  if (!response.ok) {
    throw new Error(`Failed to delete target group knowledge: ${response.status}`);
  }
}

export async function fetchTargetGroupDocuments(
  targetGroupId: string
): Promise<PersonaDocument[]> {
  const response = await forwardPersonaBackend(`/target-groups/${targetGroupId}/documents`, {
    method: "GET",
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch target group documents: ${response.status}`);
  }
  return (await response.json()) as PersonaDocument[];
}

export async function uploadTargetGroupDocument(
  targetGroupId: string,
  file: File,
  uploadedBy?: string
): Promise<PersonaDocument> {
  const formData = new FormData();
  formData.append("file", file);
  if (uploadedBy) {
    formData.append("uploaded_by", uploadedBy);
  }

  const response = await forwardPersonaBackend(`/target-groups/${targetGroupId}/documents`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to upload target group document: ${response.status} - ${errorText}`);
  }

  return (await response.json()) as PersonaDocument;
}

export async function fetchTargetGroupChunks(
  targetGroupId: string,
  limit: number = 1000
): Promise<KnowledgeChunk[]> {
  const response = await forwardPersonaBackend(
    `/target-groups/${targetGroupId}/knowledge/chunks?limit=${limit}`,
    {
      method: "GET",
    }
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch target group chunks: ${response.status}`);
  }
  return (await response.json()) as KnowledgeChunk[];
}

export interface ClusterOptions {
  method?: "kmeans" | "dbscan";
  nClusters?: number;
  minSamples?: number;
  limit?: number;
}

export async function fetchTargetGroupClusters(
  targetGroupId: string,
  options: ClusterOptions = {}
): Promise<ClusterResult> {
  const {
    method = "kmeans",
    nClusters = 10,
    minSamples = 3,
    limit = 1000,
  } = options;

  const params = new URLSearchParams({
    method,
    n_clusters: nClusters.toString(),
    min_samples: minSamples.toString(),
    limit: limit.toString(),
  });

  const response = await forwardPersonaBackend(
    `/target-groups/${targetGroupId}/knowledge/clusters?${params.toString()}`,
    {
      method: "GET",
    }
  );
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch target group clusters: ${response.status} - ${errorText}`);
  }
  return (await response.json()) as ClusterResult;
}

export async function fetchSimilarChunks(
  targetGroupId: string,
  chunkId: string,
  limit: number = 10
): Promise<SimilarChunk[]> {
  const response = await forwardPersonaBackend(
    `/target-groups/${targetGroupId}/knowledge/chunks/${chunkId}/similar?limit=${limit}`,
    {
      method: "GET",
    }
  );
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch similar chunks: ${response.status} - ${errorText}`);
  }
  return (await response.json()) as SimilarChunk[];
}

export type TargetGroupPersonaGenerateRequest = {
  segment: string;
  description?: string;
  filterMode?: "auto" | "documents" | "chunks_manual";
  documentIds?: string[];
  chunkIds?: string[];
  chunkWeights?: Record<string, number>;
  variationParams?: Record<string, any>;
  limitChunks?: number;
};

export async function fetchTargetGroupPersonas(
  targetGroupId: string,
  status?: string,
  search?: string,
  page: number = 1,
  pageSize: number = 20
): Promise<PersonaListResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    page_size: pageSize.toString(),
  });
  if (status) {
    params.append("status", status);
  }
  if (search) {
    params.append("q", search);
  }
  const response = await forwardPersonaBackend(`/target-groups/${targetGroupId}/personas?${params.toString()}`, {
    method: "GET",
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch target group personas: ${response.status} - ${errorText}`);
  }
  return (await response.json()) as PersonaListResponse;
}

export async function generateTargetGroupPersona(
  targetGroupId: string,
  request: TargetGroupPersonaGenerateRequest
): Promise<PersonaResponse> {
  // Use the Next.js API route instead of calling backend directly
  const response = await fetch(`/api/target-groups/${targetGroupId}/personas/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      segment: request.segment,
      description: request.description,
      filter_mode: request.filterMode ?? "auto",
      document_ids: request.documentIds,
      chunk_ids: request.chunkIds,
      chunk_weights: request.chunkWeights,
      variation_params: request.variationParams,
      limit_chunks: request.limitChunks,
    }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to generate target group persona: ${response.status} - ${errorText}`);
  }
  return (await response.json()) as PersonaResponse;
}

