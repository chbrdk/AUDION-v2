"use server";

/**
 * React 19 Server Action — submits to persona-api `POST /personas/generate` (`PersonaGenerateRequest`).
 *
 * Form fields:
 * - `project_id` (required, UUID)
 * - `segment` (required)
 * - `persona_id` (optional UUID)
 * - `output_locale` (optional `en` | `de`)
 */

import { revalidatePath } from "next/cache";

import { buildAuthHeaders, getServerAuthToken } from "../../_lib/auth";
import { getPersonaBackendBase } from "../../_lib/backend";
import { parsePersonaGenerateForm } from "../../../../lib/persona-generate-api-body";

export type CreatePersonaActionState = {
  success: boolean;
  message?: string;
  errors?: Record<string, string[]>;
  personaId?: string;
};

export async function createPersonaAction(
  _prevState: CreatePersonaActionState | null,
  formData: FormData
): Promise<CreatePersonaActionState> {
  try {
    const parsed = parsePersonaGenerateForm(formData);
    if (!parsed.ok) {
      return {
        success: false,
        errors: parsed.errors,
      };
    }

    const token = await getServerAuthToken();
    if (!token) {
      return {
        success: false,
        message: "Not authenticated",
      };
    }

    const base = getPersonaBackendBase({ preferPublic: false });
    const headers = new Headers(buildAuthHeaders(token));
    headers.set("Content-Type", "application/json");

    const response = await fetch(`${base}/personas/generate`, {
      method: "POST",
      headers,
      body: JSON.stringify(parsed.body),
      signal: AbortSignal.timeout(120_000),
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        success: false,
        message: `Failed to create persona: ${error}`,
      };
    }

    const result = await response.json();

    revalidatePath("/admin/personas");

    return {
      success: true,
      message: "Persona created successfully",
      personaId: result.id,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
