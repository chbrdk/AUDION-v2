/**
 * Central route paths for site-preview (no hostnames).
 * Use with `process.env.NEXT_PUBLIC_SITE_PREVIEW_BASE_URL` or deployment base URL.
 */
export const SITE_PREVIEW_PATHS = {
  demo: "/p/demo",
  previewJob: (jobId: string) => `/p/${encodeURIComponent(jobId)}`,
  internalRenderJob: "/api/internal/render-job",
  internalReady: (jobId: string) => `/api/internal/ready/${encodeURIComponent(jobId)}`,
} as const;
