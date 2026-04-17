import { describe, it, expect } from "vitest";
import { systemPromptTooltipContentSx } from "./system-prompt-tooltip-content-sx";

describe("systemPromptTooltipContentSx", () => {
  it("uses theme primary text so prompt copy stays legible on light tooltip surfaces", () => {
    expect(systemPromptTooltipContentSx).toMatchObject({
      color: "var(--color-text-primary)",
    });
  });
});
