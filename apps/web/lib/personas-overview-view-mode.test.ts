import { describe, expect, it } from "vitest";
import {
  isPersonasOverviewViewMode,
  normalizePersonasOverviewViewMode,
  PERSONAS_OVERVIEW_VIEW_MODE_STORAGE_KEY,
  PERSONAS_OVERVIEW_VIEW_MODES,
} from "./personas-overview-view-mode";

describe("personas-overview-view-mode", () => {
  it("recognizes cards and list", () => {
    expect(isPersonasOverviewViewMode("cards")).toBe(true);
    expect(isPersonasOverviewViewMode("list")).toBe(true);
    expect(isPersonasOverviewViewMode("grid")).toBe(false);
    expect(isPersonasOverviewViewMode(null)).toBe(false);
  });

  it("normalizes invalid values to null", () => {
    expect(normalizePersonasOverviewViewMode("list")).toBe("list");
    expect(normalizePersonasOverviewViewMode("table")).toBe(null);
  });

  it("exports stable storage key and mode list", () => {
    expect(PERSONAS_OVERVIEW_VIEW_MODE_STORAGE_KEY).toBe("audion-personas-overview-view");
    expect(PERSONAS_OVERVIEW_VIEW_MODES).toEqual(["cards", "list"]);
  });
});
