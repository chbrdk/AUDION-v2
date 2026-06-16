/**
 * HTTP client for AUDION API. All requests use Bearer token from env.
 */

import {
  audionWebUrlMisconfigMessage,
  formatFastApiErrorDetail,
  isHtmlOrLoginBody,
} from './audion-api-detect.js';

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
    const contentType =
      typeof res.headers?.get === 'function' ? res.headers.get('content-type') : null;
    let data: T;
    try {
      data = text ? (JSON.parse(text) as T) : ({} as T);
    } catch {
      if (!res.ok && isHtmlOrLoginBody(contentType, text)) {
        return {
          error: true,
          message: `${audionWebUrlMisconfigMessage()} HTTP ${res.status}.`,
          status: res.status,
        };
      }
      return {
        error: true,
        message: res.ok
          ? text || 'Empty response'
          : `HTTP ${res.status}: ${text.slice(0, 200)}`,
        status: res.status,
      };
    }
    if (!res.ok) {
      const err = data as {
        error?: string;
        message?: string;
        detail?: unknown;
      };
      const detail = formatFastApiErrorDetail(err?.detail);
      return {
        error: true,
        message:
          err?.error ??
          err?.message ??
          detail ??
          `HTTP ${res.status}`,
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
