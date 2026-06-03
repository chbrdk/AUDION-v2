import { describe, expect, it } from "vitest";
import { extractPersonaId } from "./persona-extract-id";

describe("extractPersonaId", () => {
  it("reads camelCase and snake_case metadata", () => {
    expect(extractPersonaId({ metadata: { personaId: "a" } })).toBe("a");
    expect(extractPersonaId({ metadata: { persona_id: "b" } })).toBe("b");
    expect(extractPersonaId({ profile: { id: "c" } })).toBe("c");
    expect(extractPersonaId({ id: "d" })).toBe("d");
  });
});
