import { NextResponse } from "next/server";

import { getPersonaBackendBase } from "./backend";

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
  const base = getPersonaBackendBase({ preferPublic: options?.preferPublic });
  return `${base}${normalizePath(path)}`;
};

type PersonaForwardOptions = RequestInit & { preferPublic?: boolean };

export const forwardPersonaBackend = async (path: string, options?: PersonaForwardOptions) => {
  const { preferPublic, cache, ...requestInit } = options ?? {};
  const target = buildPersonaBackendUrl(path, { preferPublic });
  const upstream = await fetch(target, {
    cache: cache ?? "no-store",
    ...requestInit,
  });
  const headers = new Headers(upstream.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers,
  });
};

