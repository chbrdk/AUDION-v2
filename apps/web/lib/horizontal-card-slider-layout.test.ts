import { describe, it, expect } from "vitest";
import {
  gapCountForSlidesVisible,
  resolveSlidesVisibleForContainerWidth,
} from "./horizontal-card-slider-layout";

describe("horizontal-card-slider-layout", () => {
  it("computes gap count from visible slide count", () => {
    expect(gapCountForSlidesVisible(3.5)).toBe(3);
    expect(gapCountForSlidesVisible(2.5)).toBe(2);
    expect(gapCountForSlidesVisible(1.75)).toBe(1);
    expect(gapCountForSlidesVisible(1)).toBe(0);
  });

  it("reduces visible slides as container width shrinks", () => {
    const base = 3.5;
    expect(resolveSlidesVisibleForContainerWidth(base, 1200)).toBe(3.5);
    expect(resolveSlidesVisibleForContainerWidth(base, 960)).toBe(3.5);
    expect(resolveSlidesVisibleForContainerWidth(base, 800)).toBe(2.5);
    expect(resolveSlidesVisibleForContainerWidth(base, 619)).toBe(1.75);
    expect(resolveSlidesVisibleForContainerWidth(base, 400)).toBe(1.15);
  });

  it("never exceeds the configured base slides visible", () => {
    expect(resolveSlidesVisibleForContainerWidth(2, 1200)).toBe(2);
    expect(resolveSlidesVisibleForContainerWidth(2, 400)).toBe(1.15);
  });
});
