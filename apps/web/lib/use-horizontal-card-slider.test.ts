import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("useHorizontalCardSlider", () => {
  it("exports scroll state hook without corner-tab callback", () => {
    const source = readFileSync(
      resolve(process.cwd(), "lib/use-horizontal-card-slider.ts"),
      "utf8"
    );
    expect(source).toContain("export function useHorizontalCardSlider");
    expect(source).not.toContain("onCornerTabControls");
  });
});
