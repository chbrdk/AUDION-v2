import { describe, expect, it } from "vitest";

import {
  moodboardCategoryDisplayLabel,
  moodboardCategoryMoodLine,
  moodboardCategoryVisual,
  moodboardGridContainerSx,
  moodboardTileCardRadius,
  moodboardTileGridSx,
  shouldShowMoodboardStrip,
} from "./moodboard-tile-ui";

describe("moodboardCategoryMoodLine", () => {
  it("returns German category hints for known categories", () => {
    expect(moodboardCategoryMoodLine("colors", "de")).toContain("Farbe");
    expect(moodboardCategoryMoodLine("COLORS", "de")).toContain("Farbe");
    expect(moodboardCategoryMoodLine("textures", "de")).toContain("Tiefe");
  });

  it("returns English for locale en", () => {
    expect(moodboardCategoryMoodLine("ui", "en")).toContain("Digital");
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

  it("uses taller rows in immersive mode", () => {
    const sx = moodboardGridContainerSx({ immersive: true }) as { gridAutoRows?: string };
    expect(sx.gridAutoRows).toContain("200");
  });
});

describe("moodboardCategoryVisual", () => {
  it("uses neutral editorial frame for all categories", () => {
    const colors = moodboardCategoryVisual("colors");
    const ui = moodboardCategoryVisual("ui");
    expect(colors.accent).toBe(ui.accent);
    expect(colors.overlay).toContain("gradient");
    expect(colors.glow).not.toContain("246");
  });

  it("labels categories for overlays", () => {
    expect(moodboardCategoryDisplayLabel("textures", "de")).toBe("Texturen");
    expect(moodboardCategoryDisplayLabel("textures", "en")).toBe("Textures");
  });
});

describe("moodboardTileCardRadius", () => {
  it("returns stable radii", () => {
    expect(moodboardTileCardRadius(0)).toBe(14);
    expect(moodboardTileCardRadius(2)).toBe(14);
  });
});

describe("shouldShowMoodboardStrip", () => {
  it("is false when moodboard is null", () => {
    expect(shouldShowMoodboardStrip(null)).toBe(false);
  });

  it("is true when there are tiles", () => {
    expect(shouldShowMoodboardStrip({ status: "ready", tiles: [{}] })).toBe(true);
  });

  it("is true for building or draft without tiles", () => {
    expect(shouldShowMoodboardStrip({ status: "building", tiles: [] })).toBe(true);
    expect(shouldShowMoodboardStrip({ status: "draft", tiles: [] })).toBe(true);
    expect(shouldShowMoodboardStrip({ status: "failed", tiles: [] })).toBe(true);
  });

  it("is false for ready with no tiles", () => {
    expect(shouldShowMoodboardStrip({ status: "ready", tiles: [] })).toBe(false);
  });
});
