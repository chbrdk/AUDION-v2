/**
 * HTTP client for AUDION API. All requests use Bearer token from env.
 */

function getConfig() {
  return {
    baseUrl: process.env.AUDION_API_URL ?? '',
    token: process.env.AUDION_API_TOKEN ?? '',
  };
}

export interface AudionFetchError {
  error: true;
  message: string;
  status?: number;
}

export async function audionFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T | AudionFetchError> {
  const { baseUrl, token } = getConfig();
  if (!baseUrl || !token) {
    return {
      error: true,
      message: 'AUDION_API_URL or AUDION_API_TOKEN not configured',
    };
  }
  const url = path.startsWith('http')
    ? path
    : `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
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

export function isAudionError<T>(
  r: T | AudionFetchError
): r is AudionFetchError {
  return (
    typeof r === 'object' &&
    r !== null &&
    'error' in r &&
    (r as AudionFetchError).error === true
  );
}
