import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("MsqdxGlassCornerTabSection", () => {
  it("defines standardized corner-tab section without slider", () => {
    const section = readFileSync(
      join(webRoot, "components/msqdx/corner-tab/msqdx-glass-corner-tab-section.tsx"),
      "utf8"
    );
    expect(section).toContain("MsqdxGlassCornerTabSection");
    expect(section).toContain("MsqdxCornerTabCard");
    expect(section).toContain("msqdx-glass-corner-tab-section");
    expect(section).toContain("tabToolbar");
    expect(section).not.toContain("MsqdxGlassHorizontalCardSlider");
  });

  it("exports section and tab from msqdx barrel", () => {
    const barrel = readFileSync(join(webRoot, "components/msqdx/index.ts"), "utf8");
    expect(barrel).toContain('export * from "./corner-tab"');
    expect(barrel).toContain('export * from "./chip"');
  });

  it("styles corner-tab section shell and chip-editor adapter", () => {
    const css = readFileSync(
      join(webRoot, "styles/msqdx-glass-corner-tab-section.css"),
      "utf8"
    );
    const shell = readFileSync(
      join(webRoot, "components/generic/msqdx-glass-pain-goals-corner-shell.tsx"),
      "utf8"
    );
    expect(css).toContain(".msqdx-glass-corner-tab-section");
    expect(css).toContain("--msqdx-corner-tab-section-surface");
    expect(shell).toContain("MsqdxGlassCornerTabSection");
    expect(shell).toContain("MsqdxGlassCornerTabSectionTab");
  });
});
