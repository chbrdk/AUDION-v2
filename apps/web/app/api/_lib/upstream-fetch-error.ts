/** Normalize Node `fetch` failures when proxying to the persona API (clear hints for ops). */

export function describePersonaUpstreamFetchError(err: unknown): {
  message: string;
  code?: string;
  hint?: string;
} {
  const message = err instanceof Error ? err.message : "Upstream request failed";
  const cause = err instanceof Error && "cause" in err ? (err as Error & { cause?: unknown }).cause : undefined;
  const code =
    cause && typeof cause === "object" && cause !== null && "code" in cause
      ? String((cause as { code?: unknown }).code)
      : undefined;
  const hint =
    code === "ECONNREFUSED"
      ? "Next.js could not open a TCP connection to the persona API URL (see NEXT_PERSONA_BACKEND_INTERNAL_URL). Prefer a stable Docker DNS service name (e.g. http://audion-api:8000), not a 172.x container IP that changes after redeploys. See knowledge/troubleshooting-503-auth-me.md"
      : undefined;
  return { message, code, hint };
}
