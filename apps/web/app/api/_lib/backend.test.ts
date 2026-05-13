import { afterEach, describe, expect, it, vi } from "vitest";

import { getPersonaBackendEnvSnapshot } from "./backend";

describe("getPersonaBackendEnvSnapshot", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers internal when set", () => {
    vi.stubEnv("NEXT_PERSONA_BACKEND_INTERNAL_URL", "http://api:8000");
    vi.stubEnv("NEXT_PUBLIC_PERSONA_BACKEND_URL", "https://public.example/api");
    expect(getPersonaBackendEnvSnapshot()).toEqual({
      personaBackendInternalUrlSet: true,
      personaBackendPublicUrlSet: true,
      personaBackendBaseSource: "NEXT_PERSONA_BACKEND_INTERNAL_URL",
    });
  });

  it("reports public when internal missing", () => {
    vi.stubEnv("NEXT_PUBLIC_PERSONA_BACKEND_URL", "https://public.example");
    expect(getPersonaBackendEnvSnapshot().personaBackendBaseSource).toBe("NEXT_PUBLIC_PERSONA_BACKEND_URL");
  });

  it("reports default when neither set", () => {
    expect(getPersonaBackendEnvSnapshot().personaBackendBaseSource).toBe("default_api_host");
  });
});
