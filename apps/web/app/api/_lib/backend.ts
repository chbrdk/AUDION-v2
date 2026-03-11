/**
 * Get the persona backend base URL
 * @param options - Configuration options
 * @param options.preferPublic - If true, prefer public URL; if false, prefer internal URL
 * @returns The base URL for the persona backend
 */
export function getPersonaBackendBase(options?: { preferPublic?: boolean }): string {
  // Client-side: always use the Next.js API proxy to avoid Mixed Content / CORS issues
  if (typeof window !== "undefined") {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
    return `${basePath}/api`;
  }

  const preferPublic = options?.preferPublic ?? false;

  if (preferPublic) {
    const publicUrl = process.env.NEXT_PUBLIC_PERSONA_BACKEND_URL?.trim();
    if (publicUrl) {
      return publicUrl;
    }
  }

  const internalUrl = process.env.NEXT_PERSONA_BACKEND_INTERNAL_URL?.trim();
  if (internalUrl) {
    return internalUrl;
  }

  // Fallback to public URL if internal is not set
  const fallbackUrl = process.env.NEXT_PUBLIC_PERSONA_BACKEND_URL?.trim();
  if (fallbackUrl) {
    return fallbackUrl;
  }

  // Default fallback - use Docker Compose service name
  return 'http://api:8000';
}

/**
 * Get the persona backend docs URL
 * @param options - Configuration options
 * @param options.preferPublic - If true, prefer public URL; if false, prefer internal URL
 * @returns The docs URL for the persona backend
 */
export function getPersonaBackendDocsUrl(options?: { preferPublic?: boolean }): string {
  const docsUrl = process.env.NEXT_PUBLIC_PERSONA_BACKEND_DOCS_URL?.trim();

  if (docsUrl) {
    return docsUrl;
  }

  const base = getPersonaBackendBase(options);
  return `${base}/docs`;
}

/**
 * Get the chat API base URL
 * @returns The base URL for the chat API
 */
export function getChatApiBase(): string {
  // Client-side: always use the Next.js API proxy to avoid Mixed Content / CORS issues
  if (typeof window !== "undefined") {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
    return `${basePath}/api/chat`;
  }

  const publicUrl = process.env.NEXT_PUBLIC_CHAT_API_URL?.trim();
  if (publicUrl) {
    return publicUrl;
  }

  // Default to internal Docker URL for server-side usage
  return 'http://chat-api:8001';
}

/**
 * Get the voice API base URL
 * @returns The base URL for the voice API
 */
export function getVoiceApiBase(): string {
  // Client-side: always use the Next.js API proxy to avoid Mixed Content / CORS issues
  if (typeof window !== "undefined") {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
    return `${basePath}/api/voice`;
  }

  const publicUrl = process.env.NEXT_PUBLIC_VOICE_API_URL?.trim();
  if (publicUrl) {
    return publicUrl;
  }

  // Default to internal Docker URL for server-side usage
  return 'http://chat-api:8001';
}

/**
 * Get the indexing API base URL
 * @returns The base URL for the indexing API
 */
export function getIndexingApiBase(): string {
  const publicUrl = process.env.NEXT_PUBLIC_INDEXING_API_URL?.trim();
  if (publicUrl) {
    return publicUrl;
  }

  // Default to internal Docker Compose service name
  return process.env.INDEXING_API_URL || 'http://indexing-api:8000';
}

/**
 * Get the base path for Next.js API routes
 * This ensures client-side fetch calls include the basePath when configured
 * @returns The base path (e.g., '/audion' or '')
 */
export function getApiBasePath(): string {
  return process.env.NEXT_PUBLIC_BASE_PATH || '';
}

/**
 * Build a full API route URL with basePath
 * @param path - The API path (e.g., '/api/personas')
 * @returns The full URL with basePath (e.g., '/audion/api/personas')
 */
export function buildApiUrl(path: string): string {
  const basePath = getApiBasePath();
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${basePath}${normalizedPath}`;
}

/**
 * Fetch with a timeout for proxy/API routes to avoid hanging requests.
 * Uses AbortSignal.timeout (60s default). Override with options.signal or second argument.
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  ms = 60_000
): Promise<Response> {
  const signal = options.signal ?? AbortSignal.timeout(ms);
  return fetch(url, { ...options, signal });
}

/** GET/POST /api/auth/tokens – list and create API tokens (central reference, same as CHECKION). */
export const API_AUTH_TOKENS = buildApiUrl("/api/auth/tokens");

/** DELETE /api/auth/tokens/[id] – revoke an API token. */
export function apiAuthTokenRevoke(id: string): string {
  return buildApiUrl(`/api/auth/tokens/${encodeURIComponent(id)}`);
}
