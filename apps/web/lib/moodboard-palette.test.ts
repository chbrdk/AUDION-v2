import { describe, expect, it } from "vitest";
import { normalizePaletteSwatches } from "./moodboard-palette";

describe("normalizePaletteSwatches", () => {
  it("parses hex swatches from API payload", () => {
    expect(
      normalizePaletteSwatches([
        { hex: "#A1B2C3", weight: 0.4 },
        { hex: "invalid" },
        { hex: "#112233" },
      ])
    ).toEqual([
      { hex: "#a1b2c3", weight: 0.4 },
      { hex: "#112233", weight: undefined },
    ]);
  });

  it("returns empty for non-arrays", () => {
    expect(normalizePaletteSwatches(null)).toEqual([]);
  });
});
