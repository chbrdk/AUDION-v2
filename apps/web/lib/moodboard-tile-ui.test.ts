import { describe, expect, it } from "vitest";

import { moodboardCategoryMoodLine, moodboardTileCardRadius, moodboardTileGridSx } from "./moodboard-tile-ui";

describe("moodboardCategoryMoodLine", () => {
  it("returns German category hints for known categories", () => {
    expect(moodboardCategoryMoodLine("colors", "de")).toContain("Palette");
    expect(moodboardCategoryMoodLine("COLORS", "de")).toContain("Palette");
    expect(moodboardCategoryMoodLine("textures", "de")).toContain("Haptik");
  });

  it("returns English for locale en", () => {
    expect(moodboardCategoryMoodLine("ui", "en")).toContain("Interaction");
  });

  it("falls back for unknown categories", () => {
    expect(moodboardCategoryMoodLine("custom", "de")).toBeTruthy();
  });
});

describe("moodboardTileGridSx", () => {
  it("uses bento placements for 8 tiles", () => {
    const a = moodboardTileGridSx(0, 8) as { md?: { gridColumn?: string } };
    const b = moodboardTileGridSx(7, 8) as { md?: { gridColumn?: string } };
    expect(a.md?.gridColumn).toBe("1 / 8");
    expect(b.md?.gridColumn).toBe("9 / 13");
  });

  it("uses hero fallback when total is not 8", () => {
    const hero = moodboardTileGridSx(0, 12) as { md?: { gridColumn?: string; gridRow?: string } };
    const rest = moodboardTileGridSx(1, 12) as { md?: { gridColumn?: string } };
    expect(hero.md?.gridColumn).toBe("span 6");
    expect(hero.md?.gridRow).toBe("span 2");
    expect(rest.md?.gridColumn).toBe("span 3");
  });
});

describe("moodboardTileCardRadius", () => {
  it("returns stable radii", () => {
    expect(moodboardTileCardRadius(0)).toBe(18);
    expect(moodboardTileCardRadius(2)).toBe(22);
  });
});
