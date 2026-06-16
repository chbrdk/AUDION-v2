import { describe, expect, it } from "vitest";
import { humanizeApiErrorMessage } from "./api-error-humanize";

describe("humanizeApiErrorMessage", () => {
  it("maps openai_not_configured to German hint", () => {
    const msg = humanizeApiErrorMessage('{"detail":"openai_not_configured"}', { locale: "de" });
    expect(msg).toContain("OPENAI_API_KEY");
  });

  it("maps 503 backend unreachable", () => {
    const msg = humanizeApiErrorMessage("Persona backend unreachable", { locale: "de" });
    expect(msg).toContain("NEXT_PERSONA_BACKEND_INTERNAL_URL");
  });

  it("passes through unknown detail", () => {
    expect(humanizeApiErrorMessage("Segment required", { locale: "de" })).toBe("Segment required");
  });
});
