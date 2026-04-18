import { withOutputLocale } from "./ai-output-locale";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Builds the JSON body for persona-api `POST /personas/generate` (`PersonaGenerateRequest`).
 * Does not include fields that the API model does not accept (e.g. free-text description / filter_mode).
 */
export function parsePersonaGenerateForm(formData: FormData):
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; errors: Record<string, string[]> } {
  const errors: Record<string, string[]> = {};

  const segment = (formData.get("segment") as string | null)?.trim() ?? "";
  if (!segment) {
    errors.segment = ["Segment is required"];
  }

  const project_id = (formData.get("project_id") as string | null)?.trim() ?? "";
  if (!project_id) {
    errors.project_id = ["Project is required"];
  } else if (!UUID_REGEX.test(project_id)) {
    errors.project_id = ["Invalid project_id"];
  }

  const persona_id_raw = formData.get("persona_id") as string | null;
  const persona_id = persona_id_raw?.trim() ?? "";
  if (persona_id && !UUID_REGEX.test(persona_id)) {
    errors.persona_id = ["Invalid persona_id"];
  }

  const outputLocaleRaw = formData.get("output_locale") as string | null;
  const output_locale =
    outputLocaleRaw && (outputLocaleRaw === "en" || outputLocaleRaw === "de") ? outputLocaleRaw : undefined;

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const base: Record<string, unknown> = { project_id, segment };
  if (persona_id) {
    base.persona_id = persona_id;
  }
  const body = output_locale ? withOutputLocale(base, output_locale) : base;
  return { ok: true, body };
}
