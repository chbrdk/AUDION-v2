import { describe, expect, it } from "vitest";

/**
 * Documents the contract of `useInlineEdit` when `baselineKey` is set:
 * adopt server `value` only when the baseline identity changes (new selection / entity).
 */
function shouldAdoptServerSnapshot(prevStoredKey: string | null, baselineKey: string): boolean {
  return prevStoredKey !== baselineKey;
}

describe("inline edit baseline contract", () => {
  it("adopts on first baseline", () => {
    expect(shouldAdoptServerSnapshot(null, "p1")).toBe(true);
  });
  it("ignores refresh when baseline unchanged", () => {
    expect(shouldAdoptServerSnapshot("p1", "p1")).toBe(false);
  });
  it("adopts when switching entity", () => {
    expect(shouldAdoptServerSnapshot("p1", "p2")).toBe(true);
  });
});
