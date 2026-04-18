import { describe, expect, it } from "vitest";
import { withOutputLocale } from "./ai-output-locale";

describe("withOutputLocale", () => {
  it("merges output_locale without mutating the original object", () => {
    const base = { segment: "x", filter_mode: "auto" as const };
    const out = withOutputLocale(base, "de");
    expect(out).toEqual({ segment: "x", filter_mode: "auto", output_locale: "de" });
    expect("output_locale" in base).toBe(false);
  });
});
