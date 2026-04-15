import { describe, it, expect } from "vitest";
import { shouldDiscardInlineEditOnSnackbarClose } from "../components/msqdx-glass-inline-edit-controls";

describe("shouldDiscardInlineEditOnSnackbarClose", () => {
  it("does not discard on clickaway (avoids breaking MUI Slider drag)", () => {
    expect(shouldDiscardInlineEditOnSnackbarClose("clickaway")).toBe(false);
  });

  it("discards on Escape so users can still cancel without hunting the Discard button", () => {
    expect(shouldDiscardInlineEditOnSnackbarClose("escapeKeyDown")).toBe(true);
  });
});
