/**
 * HTTP client for AUDION Chat API (separate service from FastAPI persona backend).
 */

export interface ChatFetchError {
  error: true;
  message: string;
  status?: number;
}

function getChatBaseUrl(): string {
  const url =
    process.env.CHAT_API_URL?.trim() ||
    process.env.AUDION_CHAT_API_URL?.trim() ||
    '';
  return url.replace(/\/$/, '');
}

export function isChatApiConfigured(): boolean {
  return Boolean(getChatBaseUrl() && (process.env.AUDION_API_TOKEN || '').trim());
}

export async function chatFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T | ChatFetchError> {
  const baseUrl = getChatBaseUrl();
  const token = process.env.AUDION_API_TOKEN ?? '';
  if (!baseUrl || !token) {
    return {
      error: true,
      message: 'CHAT_API_URL (or AUDION_CHAT_API_URL) and AUDION_API_TOKEN must be set for chat tools',
    };
  }
  const url = path.startsWith('http')
    ? path
    : `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const headers: HeadersInit = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  try {
    const res = await fetch(url, { ...options, headers });
    const text = await res.text();
    let data: T;
    try {
      data = text ? (JSON.parse(text) as T) : ({} as T);
    } catch {
      return {
        error: true,
        message: res.ok
          ? text || 'Empty response'
          : `HTTP ${res.status}: ${text.slice(0, 200)}`,
        status: res.status,
      };
    }
    if (!res.ok) {
      const err = data as { error?: string; message?: string; detail?: string };
      return {
        error: true,
        message:
          err?.error ?? err?.message ?? err?.detail ?? `HTTP ${res.status}`,
        status: res.status,
      };
    }
    return data;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { error: true, message: `Request failed: ${message}` };
  }
}

export function isChatFetchError(r: unknown): r is ChatFetchError {
  return (
    typeof r === 'object' &&
    r !== null &&
    'error' in r &&
    (r as ChatFetchError).error === true
  );
}
