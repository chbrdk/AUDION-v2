"use server";

/**
 * React 19 Server Action für Persona-Erstellung
 * 
 * Beispiel-Implementierung für React 19 Actions API
 * Vereinfacht Form-Submissions mit automatischem Pending-State-Management
 */

import { revalidatePath } from "next/cache";

export type CreatePersonaActionState = {
  success: boolean;
  message?: string;
  errors?: Record<string, string[]>;
  personaId?: string;
};

export async function createPersonaAction(
  prevState: CreatePersonaActionState | null,
  formData: FormData
): Promise<CreatePersonaActionState> {
  try {
    const segment = formData.get("segment") as string;
    const description = formData.get("description") as string | null;
    const outputLocaleRaw = formData.get("output_locale") as string | null;
    const output_locale =
      outputLocaleRaw && (outputLocaleRaw === "en" || outputLocaleRaw === "de") ? outputLocaleRaw : undefined;

    if (!segment?.trim()) {
      return {
        success: false,
        errors: {
          segment: ["Segment is required"],
        },
      };
    }

    // API Call
    const base = process.env.NEXT_PERSONA_BACKEND_INTERNAL_URL || 
                 process.env.NEXT_PUBLIC_PERSONA_BACKEND_URL;
    
    const response = await fetch(`${base}/personas/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        segment: segment.trim(),
        description: description?.trim() || undefined,
        filterMode: "auto",
        ...(output_locale ? { output_locale } : {}),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        success: false,
        message: `Failed to create persona: ${error}`,
      };
    }

    const result = await response.json();
    
    // Revalidate personas page
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
