/**
 * Discovery client for Opal (or other) discovery endpoints.
 * Fetches available tools/APIs from a discovery URL and allows direct calls with Bearer token.
 * @see knowledge/urls-and-discovery.md
 */

/** Optional fetch implementation (e.g. Figma plugin figmaFetch). */
export type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string }
) => Promise<Pick<Response, 'ok' | 'status' | 'text' | 'json'>>;

export interface DiscoveredTool {
  id: string;
  name?: string;
  /** Full URL or path relative to discovery base. */
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Optional description for UI/docs. */
  description?: string;
}

export interface DiscoveryResponse {
  /** Base URL for relative tool URLs. */
  base_url?: string;
  tools: DiscoveredTool[];
  /** Optional API version or metadata. */
  version?: string;
}

let cachedDiscovery: DiscoveryResponse | null = null;
let cachedDiscoveryUrl = '';

/**
 * Fetches discovery document from the given URL.
 * Uses Bearer token when provided. Caches result per URL.
 * Pass fetchFn when running in Figma plugin main thread (e.g. figmaFetch).
 */
export async function fetchDiscovery(
  discoveryUrl: string,
  bearerToken?: string,
  fetchFn?: FetchLike
): Promise<DiscoveryResponse> {
  if (!discoveryUrl || !discoveryUrl.startsWith('http')) {
    throw new Error('Invalid discovery URL');
  }
  const doFetch = fetchFn ?? fetch;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (bearerToken) {
    headers['Authorization'] = `Bearer ${bearerToken}`;
  }
  const res = await doFetch(discoveryUrl, { method: 'GET', headers });
  if (!res.ok) {
    throw new Error(`Discovery failed: ${res.status} - ${await res.text()}`);
  }
  const data = (await res.json()) as DiscoveryResponse;
  if (!data || !Array.isArray(data.tools)) {
    throw new Error('Discovery response must contain a "tools" array');
  }
  cachedDiscovery = data;
  cachedDiscoveryUrl = discoveryUrl;
  return data;
}

/**
 * Returns cached discovery if it was fetched for the same URL; otherwise null.
 */
export function getCachedDiscovery(discoveryUrl: string): DiscoveryResponse | null {
  return cachedDiscoveryUrl === discoveryUrl ? cachedDiscovery : null;
}

/**
 * Resolves tool URL: if tool.url is relative, prepends discovery base_url.
 */
function resolveToolUrl(tool: DiscoveredTool, baseUrl: string): string {
  const url = tool.url;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  const base = baseUrl.replace(/\/$/, '');
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
}

/**
 * Calls a discovered tool/API by id. Uses Bearer token for auth.
 * Pass discoveryUrl and optional bearerToken; toolId must match a tool from discovery.
 * Pass fetchFn when running in Figma plugin main thread.
 */
export async function callDiscoveredTool<T = unknown>(
  discoveryUrl: string,
  toolId: string,
  options: {
    bearerToken?: string;
    body?: unknown;
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    fetchFn?: FetchLike;
  } = {}
): Promise<T> {
  const doFetch = options.fetchFn ?? fetch;
  let discovery = getCachedDiscovery(discoveryUrl);
  if (!discovery) {
    discovery = await fetchDiscovery(discoveryUrl, options.bearerToken, doFetch);
  }
  const tool = discovery.tools.find((t) => t.id === toolId);
  if (!tool) {
    throw new Error(`Tool not found: ${toolId}. Available: ${discovery.tools.map((t) => t.id).join(', ')}`);
  }
  const baseUrl = discovery.base_url || discoveryUrl.replace(/\/[^/]*$/, '');
  const url = resolveToolUrl(tool, baseUrl);
  const method = options.method ?? tool.method;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (options.bearerToken) {
    headers['Authorization'] = `Bearer ${options.bearerToken}`;
  }
  const init: { method: string; headers: Record<string, string>; body?: string } = { method, headers };
  if (bodyAllowed(method) && options.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }
  const res = await doFetch(url, init);
  if (!res.ok) {
    throw new Error(`Tool ${toolId} failed: ${res.status} - ${await res.text()}`);
  }
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

function bodyAllowed(m: string): boolean {
  return m === 'POST' || m === 'PUT' || m === 'PATCH';
}

/**
 * Lists available tool IDs from discovery (fetches if not cached).
 * Pass fetchFn when running in Figma plugin main thread.
 */
export async function listDiscoveredTools(
  discoveryUrl: string,
  bearerToken?: string,
  fetchFn?: FetchLike
): Promise<DiscoveredTool[]> {
  let discovery = getCachedDiscovery(discoveryUrl);
  if (!discovery) {
    discovery = await fetchDiscovery(discoveryUrl, bearerToken, fetchFn);
  }
  return discovery.tools;
}
