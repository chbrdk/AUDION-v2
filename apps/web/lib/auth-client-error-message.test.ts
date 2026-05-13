import { describe, expect, it } from "vitest";

import { resolveAuthApiErrorMessage } from "./auth-client-error-message";

describe("resolveAuthApiErrorMessage", () => {
  const t = (key: string) => (key === "auth.personaBackendUnavailable" ? "PERSONA_DOWN" : "FALLBACK");

  it("maps 503 Authentication service unavailable to persona message", () => {
    const res = new Response(null, { status: 503 });
    expect(
      resolveAuthApiErrorMessage(res, { detail: "Authentication service unavailable" }, t, "auth.login.error")
    ).toBe("PERSONA_DOWN");
  });

  it("maps 503 Persona backend unreachable error field", () => {
    const res = new Response(null, { status: 503 });
    expect(resolveAuthApiErrorMessage(res, { error: "Persona backend unreachable" }, t, "auth.login.error")).toBe(
      "PERSONA_DOWN"
    );
  });

  it("returns detail for other failures", () => {
    const res = new Response(null, { status: 401 });
    expect(resolveAuthApiErrorMessage(res, { detail: "Invalid credentials" }, t, "auth.login.error")).toBe(
      "Invalid credentials"
    );
  });

  it("uses fallback when empty body", () => {
    const res = new Response(null, { status: 503 });
    expect(resolveAuthApiErrorMessage(res, {}, t, "auth.login.error")).toBe("FALLBACK");
  });
});
