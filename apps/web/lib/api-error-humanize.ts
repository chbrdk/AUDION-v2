/**
 * Map raw API / proxy errors to user-facing German/English hints.
 * Keeps technical detail for logs; surfaces actionable messages in the UI.
 */

type HumanizeOptions = {
  locale?: string;
  context?: "persona" | "target_group" | "generic";
};

function parseDetail(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    const json = JSON.parse(trimmed) as { detail?: unknown; error?: unknown; message?: unknown };
    const detail = json.detail ?? json.error ?? json.message;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item) => (typeof item === "object" && item && "msg" in item ? String((item as { msg: string }).msg) : String(item)))
        .join("; ");
    }
  } catch {
    /* plain text */
  }
  return trimmed;
}

export function humanizeApiErrorMessage(raw: string, options: HumanizeOptions = {}): string {
  const locale = options.locale ?? "de";
  const detail = parseDetail(raw);
  const lower = detail.toLowerCase();
  const de = locale === "de";

  if (
    lower.includes("persona backend unreachable") ||
    lower.includes("service unavailable") ||
    /\b503\b/.test(detail) ||
    lower.includes("econnrefused") ||
    lower.includes("fetch failed")
  ) {
    return de
      ? "Das Persona-Backend ist nicht erreichbar. In Coolify prüfen: API-Container läuft und NEXT_PERSONA_BACKEND_INTERNAL_URL zeigt auf den internen Service-Namen (z. B. http://audion-api:8000), nicht auf eine Docker-IP."
      : "Persona backend unreachable. Check Coolify: API container running and NEXT_PERSONA_BACKEND_INTERNAL_URL points to the internal service hostname.";
  }

  if (lower.includes("openai_not_configured") || lower.includes("openai api key")) {
    return de
      ? "KI ist auf dem API-Server nicht konfiguriert. Setze OPENAI_API_KEY oder ANTHROPIC_API_KEY auf dem AUDION-API-Container und starte neu."
      : "AI is not configured on the API server. Set OPENAI_API_KEY or ANTHROPIC_API_KEY on the AUDION API container.";
  }

  if (lower.includes("not authenticated") || lower.includes("unauthorized") || /\b401\b/.test(detail)) {
    return de
      ? "Sitzung abgelaufen — bitte neu anmelden."
      : "Session expired — please sign in again.";
  }

  if (
    lower.includes("audion_api_url") ||
    lower.includes("audion_api_token") ||
    lower.includes("mcp") && lower.includes("not configured")
  ) {
    return de
      ? "AUDION-Anbindung (API/MCP) ist nicht vollständig konfiguriert. Das betrifft PLEXON/Board-Assistenten — in AUDION direkt: API-Token und Backend-URL prüfen."
      : "AUDION API/MCP integration is not fully configured.";
  }

  if (options.context === "target_group" && lower.includes("project")) {
    return de
      ? "Bitte zuerst ein Projekt auswählen (Header: Projekt-Picker)."
      : "Select a project first (header project picker).";
  }

  return detail || (de ? "Anfrage fehlgeschlagen" : "Request failed");
}
