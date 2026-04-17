import { describe, it, expect } from "vitest";
import {
  systemPromptTooltipContentSx,
  systemPromptTooltipSlotSx,
} from "./system-prompt-tooltip-content-sx";

describe("system prompt tooltip layout", () => {
  it("keeps scrollable inner box styles without forcing a CSS variable text color", () => {
    expect(systemPromptTooltipContentSx).toMatchObject({
      maxWidth: "400px",
      maxHeight: "300px",
    });
    expect(systemPromptTooltipContentSx).not.toHaveProperty("color");
  });

  it("uses theme palette for tooltip text so contrast matches light/dark", () => {
    expect(typeof (systemPromptTooltipSlotSx as { color?: unknown }).color).toBe("function");
    expect(systemPromptTooltipSlotSx).toMatchObject({
      backgroundColor: "var(--color-neutral)",
      padding: 0,
    });
  });
});
