import { describe, expect, it } from "vitest";
import { personaUxJourneyTaskPreview } from "./persona-ux-journey-task-preview";

describe("personaUxJourneyTaskPreview", () => {
  it("truncates long tasks", () => {
    const long = "a".repeat(300);
    expect(personaUxJourneyTaskPreview(long, 220).length).toBeLessThanOrEqual(220);
    expect(personaUxJourneyTaskPreview(long, 220).endsWith("…")).toBe(true);
  });

  it("returns empty for blank", () => {
    expect(personaUxJourneyTaskPreview("  ", 100)).toBe("");
  });
});
