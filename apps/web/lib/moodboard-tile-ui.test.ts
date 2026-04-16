import { describe, expect, it } from "vitest";

import {
  moodboardCategoryMoodLine,
  moodboardGridContainerSx,
  moodboardTileCardRadius,
  moodboardTileGridSx,
} from "./moodboard-tile-ui";

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
  it("uses 3-column bento placements for 8 tiles from sm", () => {
    const a = moodboardTileGridSx(0, 8) as { sm?: { gridColumn?: string; gridRow?: string } };
    const b = moodboardTileGridSx(7, 8) as { sm?: { gridColumn?: string } };
    expect(a.sm?.gridColumn).toBe("1 / 3");
    expect(a.sm?.gridRow).toBe("1 / 3");
    expect(b.sm?.gridColumn).toBe("2 / 3");
  });

  it("uses hero fallback when total is not 8 (3-col max)", () => {
    const hero = moodboardTileGridSx(0, 12) as { sm?: { gridColumn?: string; gridRow?: string } };
    const rest = moodboardTileGridSx(1, 12) as { sm?: { gridColumn?: string } };
    expect(hero.sm?.gridColumn).toBe("1 / 3");
    expect(hero.sm?.gridRow).toBe("span 2");
    expect(rest.sm?.gridColumn).toBe("span 1");
  });
});

describe("moodboardGridContainerSx", () => {
  it("caps at 3 columns from sm", () => {
    const sx = moodboardGridContainerSx() as { gridTemplateColumns?: { xs?: string; sm?: string } };
    expect(sx.gridTemplateColumns?.xs).toContain("repeat(2");
    expect(sx.gridTemplateColumns?.sm).toBe("repeat(3, 1fr)");
  });
});

describe("moodboardTileCardRadius", () => {
  it("returns stable radii", () => {
    expect(moodboardTileCardRadius(0)).toBe(18);
    expect(moodboardTileCardRadius(2)).toBe(22);
  });
});
