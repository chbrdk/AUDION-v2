import { NextResponse } from "next/server";

import { getPersonaBackendBase } from "./backend";
import { getServerAuthToken } from "./auth";

type ParamsRecord = Record<string, string | undefined>;
type MaybePromise<T> = T | Promise<T>;

export type PersonaRouteContext<TParams extends ParamsRecord> =
  | { params: TParams }
  | { params: MaybePromise<TParams> };

export const resolvePersonaParams = async <TParams extends ParamsRecord>(
  context: PersonaRouteContext<TParams>,
): Promise<TParams> => {
  const ctxParams = context.params;
  if (typeof (ctxParams as any)?.then === "function") {
    const resolved = await (ctxParams as Promise<TParams>);
    return (resolved ?? {}) as TParams;
  }
  return ((ctxParams as TParams) ?? {}) as TParams;
};

const normalizePath = (path: string) => (path.startsWith("/") ? path : `/${path}`);

export const buildPersonaBackendUrl = (path: string, options?: { preferPublic?: boolean }) => {
  // If running on client side, use the Next.js API proxy routes
  if (typeof window !== "undefined") {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    return `${basePath}/api${normalizePath(path)}`;
  }

  // Server-side: use the internal Docker URL or public URL as configured
  const base = getPersonaBackendBase({ preferPublic: options?.preferPublic });
  return `${base}${normalizePath(path)}`;
};

type PersonaForwardOptions = RequestInit & { preferPublic?: boolean };

export const forwardPersonaBackend = async (path: string, options?: PersonaForwardOptions) => {
  const { preferPublic, cache, ...requestInit } = options ?? {};
  const target = buildPersonaBackendUrl(path, { preferPublic });
  const headers = new Headers(requestInit.headers);
  if (!headers.has("Authorization")) {
    const token = await getServerAuthToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }
  const upstream = await fetch(target, {
    cache: cache ?? "no-store",
    ...requestInit,
    headers,
  });
  const responseHeaders = new Headers(upstream.headers);
  if (!responseHeaders.has("content-type")) {
    responseHeaders.set("content-type", "application/json");
  }
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
};
