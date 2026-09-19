/**
 * HTTP client for AUDION API.
 * Auth: Bearer AUDION_API_TOKEN + X-Plexon-User-Id (Access Model B actor).
 * Spec: plexon-v3/specs/domain/assistant-actor-identity.md
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import {
  audionWebUrlMisconfigMessage,
  formatFastApiErrorDetail,
  isHtmlOrLoginBody,
} from './audion-api-detect.js';

export const audionActorStore = new AsyncLocalStorage<string>();

export type AudionFetchOptions = {
  actorUserId?: string;
};

export type AudionRequestInit = RequestInit & {
  audion?: AudionFetchOptions;
};

function getConfig() {
  return {
    baseUrl: process.env.AUDION_API_URL ?? '',
    token: process.env.AUDION_API_TOKEN ?? '',
    serviceSecret:
      process.env.PLEXON_SERVICE_SECRET?.trim() ||
      process.env.AUDION_SERVICE_SECRET?.trim() ||
      '',
    contract:
      process.env.PLEXON_FEDERATION_CONTRACT_VERSION?.trim() ||
      '2026-05-plexon-federation-v3',
  };
}

export interface AudionFetchError {
  error: true;
  message: string;
  status?: number;
}

export async function audionFetch<T = unknown>(
  path: string,
  options: AudionRequestInit = {}
): Promise<T | AudionFetchError> {
  const { baseUrl, token, serviceSecret, contract } = getConfig();
  if (!baseUrl || (!token && !serviceSecret)) {
    return {
      error: true,
      message: 'AUDION_API_URL or AUDION_API_TOKEN/PLEXON_SERVICE_SECRET not configured',
    };
  }
  const { audion, ...fetchOptions } = options;
  const actor =
    audion?.actorUserId?.trim() || audionActorStore.getStore()?.trim() || '';
  if (!actor) {
    return {
      error: true,
      message: 'actorUserId required for machine auth (Access Model B)',
    };
  }
  const url = path.startsWith('http')
    ? path
    : `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Plexon-User-Id': actor,
    ...(fetchOptions.headers as Record<string, string>),
  };
  if (serviceSecret) {
    headers['X-Service-Secret'] = serviceSecret;
    headers['X-Plexon-Contract-Version'] = contract;
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  try {
    const res = await fetch(url, { ...fetchOptions, headers });
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
