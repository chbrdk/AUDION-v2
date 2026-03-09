export * from './events';
export * from './field-definitions';

export type PersonaProfile = {
  id: string;
  name: string;
  segment: string;
  headline: string;
  bio: string;
  full_name?: string | null;
  age?: number | null;
  location?: string | null;
  gender?: string | null;
  media_affinity?: number | null;
  interests?: string[];
  color_palette?: string[];
  attention_span?: string | null;
  social_media_usage?: string[];
  values?: string[];
  traits: Record<string, number>;
  pain_points: Array<{ label: string; evidence_count: number }>;
  goals: Array<{ label: string; priority: number }>;
  communication_style: {
    vocabulary: string[];
    sentence_structure: string;
    skepticism_level: number;
  };
  confidence: number;
  version: string;
  created_at: string;
  avatar_url?: string | null;
  targetGroupId?: string | null;
};

export type PersonaPrompt = {
  persona_id: string;
  system_prompt: string;
  template_version: string;
};

export type PersonaMetadata = {
  personaId: string;
  projectId: string;
  status: string;
  version: string;
  confidence: number;
  updatedAt: string;
  updatedBy?: string | null;
  lastReviewedAt?: string | null;
  imageUrl?: string | null;
  avatarUrl?: string | null;
  consoleUrl: string;
  lockedBy?: string | null;
  lockedAt?: string | null;
  graphUrl?: string | null;
  graphBloomUrl?: string | null;
  targetGroupId?: string | null;
};

export type PersonaDocument = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedBy?: string | null;
  downloadUrl?: string | null;
  insightSummary?: string | null;
  ingestionStatus?: string | null; // pending, processing, completed, failed
  ingestionProgress?: number | null; // 0-100
};

export type PersonaKnowledgeEntry = {
  id: string;
  personaId: string;
  title: string;
  content: string;
  metadata?: Record<string, any> | null;
  createdBy: string;
  createdAt: string;
};

export type PersonaInsight = {
  relatedChunkIds: string[];
  graphRelationships: Array<{ relationship?: string; nodes: string[] }>;
};

export type PersonaListItem = {
  id: string;
  projectId?: string;
  name: string;
  segment: string;
  headline: string;
  status: string;
  confidence: number;
  version: string;
  updatedAt: string | null;
  updatedBy?: string | null;
  imageUrl?: string | null;
  avatarUrl?: string | null;
};

export type PersonaListResponse = {
  items: PersonaListItem[];
  total: number;
  page: number;
  page_size: number;
};

export type PersonaResponse = {
  profile: PersonaProfile;
  prompt: PersonaPrompt;
  sources: Array<{ chunk_id: string; confidence: number; rationale?: string | null }>;
  metadata: PersonaMetadata;
  documents: PersonaDocument[];
  knowledge: PersonaKnowledgeEntry[];
  insights?: PersonaInsight | null;
};

export type UploadJobStatus =
  | { status: 'processing'; progress: number }
  | { status: 'completed'; document_id: string }
  | { status: 'failed'; reason: string };

export type PersonaKnowledgeUpsertRequest = {
  title: string;
  content: string;
  metadata?: Record<string, any> | null;
  created_by?: string;
};

export type TargetGroup = {
  id: string;
  projectId: string;
  name: string;
  segment: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TargetGroupListItem = {
  id: string;
  name: string;
  segment: string;
  description?: string | null;
  personaCount: number;
  knowledgeEntryCount: number;
  createdAt: string;
  updatedAt: string;
};

export type TargetGroupListResponse = {
  items: TargetGroupListItem[];
  total: number;
  page: number;
  page_size: number;
};

export type TargetGroupResponse = {
  id: string;
  projectId: string;
  name: string;
  segment: string;
  description?: string | null;
  personas: PersonaListItem[];
  knowledgeEntries: PersonaKnowledgeEntry[];
  sources: Array<{ chunkId: string; relevanceScore: number }>;
  createdAt: string;
  updatedAt: string;
};

export type TargetGroupKnowledgeEntry = {
  id: string;
  personaId: string; // For compatibility, same structure as PersonaKnowledgeEntry
  title: string;
  content: string;
  metadata?: Record<string, any> | null;
  createdBy: string;
  createdAt: string;
};

export type ProcessingJobListItem = {
  id: string;
  documentId: string;
  status: string; // pending, processing, completed, failed
  progress: number;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProcessingJobListResponse = {
  items: ProcessingJobListItem[];
  total: number;
  page: number;
  page_size: number;
};

export type ProcessingJobDetailResponse = {
  id: string;
  documentId: string;
  documentFilename?: string | null;
  documentSizeBytes?: number | null;
  status: string;
  progress: number;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
  celeryTaskId?: string | null;
};

export type CeleryTaskStatus = {
  taskId: string;
  status: string; // PENDING, STARTED, SUCCESS, FAILURE, RETRY, REVOKED
  result?: any | null;
  error?: string | null;
  traceback?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
};

export type QueueStatsResponse = {
  pendingCount: number;
  processingCount: number;
  completedCount: number;
  failedCount: number;
  workerAvailable: boolean;
  workerCount: number;
};

export type ServiceStatus = {
  name: string;
  status: "up" | "down" | "unknown";
  message?: string | null;
};

export type ServiceStatusResponse = {
  services: ServiceStatus[];
  allServicesUp: boolean;
};

export type LogEntry = {
  level: string; // DEBUG, INFO, WARNING, ERROR
  message: string;
  timestamp: string;
  context?: Record<string, any> | null;
  jobId?: string | null;
  documentId?: string | null;
};

export type LogListResponse = {
  items: LogEntry[];
  total: number;
  page: number;
  page_size: number;
};

export type KnowledgeChunk = {
  id: string;
  content: string;
  documentId: string;
  documentFilename?: string | null;
  relevanceScore: number;
  metadata?: Record<string, any> | null;
  x?: number | null; // 2D coordinate for visualization
  y?: number | null; // 2D coordinate for visualization
  clusterId?: number | null;
};

export type KnowledgeCluster = {
  id: number;
  topic: string;
  description: string;
  size: number;
  chunkIds: string[];
};

export type ClusterResult = {
  clusters: KnowledgeCluster[];
  chunks: KnowledgeChunk[];
  coordinates2d: number[][]; // [[x1, y1], [x2, y2], ...]
  clusterLabels: number[]; // Cluster ID for each chunk (same order as chunks)
  method: string; // "kmeans" or "dbscan"
};

export type SimilarChunk = {
  id: string;
  content: string;
  similarity: number; // Similarity score (0-1)
  documentId: string;
};

