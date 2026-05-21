import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("persona personality layout", () => {
  it("uses horizontal slider stack in the personality card (v2-style)", () => {
    const source = readFileSync(
      resolve(process.cwd(), "components/dashboard-cards/msqdx-glass-personality-card.tsx"),
      "utf8"
    );
    expect(source).toContain('chipLayout: "slider"');
    expect(source).toContain("slidesVisible: 3.5");
    expect(source).toContain("msqdx-glass-personality-stack");
    expect(source).toContain("msqdx-glass-personality-stack__block");
    expect(source).toContain("MsqdxGlassPainGoalsSectorSeparator");
    expect(source).toContain("embedInSection");
    expect(source).toContain('cornerTabPlacement: "top-right"');
    expect(source).toContain("msqdx-glass-personality-section");
  });

  it("passes embedInSection from persona admin panel for v2 sections", () => {
    const panel = readFileSync(
      resolve(process.cwd(), "components/msqdx-glass-persona-admin-panel.tsx"),
      "utf8"
    );
    expect(panel).toMatch(
      /MsqdxGlassPersonalityCard[\s\S]*?embedInSection=\{isV2Section\}/
    );
  });

  it("styles personality stack blocks like pain-goals", () => {
    const css = readFileSync(resolve(process.cwd(), "styles/dashboard-cards.css"), "utf8");
    expect(css).toContain(".msqdx-glass-personality-stack__block");
    expect(css).toMatch(
      /\.msqdx-glass-pain-goals-stack__block,\s*\n\.msqdx-glass-personality-stack__block/
    );
  });
});
