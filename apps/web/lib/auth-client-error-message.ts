type AuthErrorPayload = {
  detail?: unknown;
  error?: unknown;
};

/**
 * Maps known API failures (e.g. persona backend unreachable) to a friendly i18n string.
 */
export function resolveAuthApiErrorMessage(
  response: Response,
  data: AuthErrorPayload,
  t: (key: string) => string,
  fallbackKey: string
): string {
  if (response.status === 503) {
    const detail = String(data.detail ?? "").toLowerCase();
    const err = String(data.error ?? "").toLowerCase();
    if (
      detail.includes("unavailable") ||
      detail.includes("authentication service") ||
      err.includes("unreachable") ||
      err.includes("persona backend")
    ) {
      return t("auth.personaBackendUnavailable");
    }
  }
  if (typeof data.detail === "string" && data.detail.trim()) return data.detail;
  if (typeof data.error === "string" && data.error.trim()) return data.error;
  return t(fallbackKey);
}
