import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("persona v2 bio flat section", () => {
  it("supports embedInSection with flat bio stack", () => {
    const bio = readFileSync(
      join(webRoot, "components/dashboard-cards/msqdx-glass-bio-card-edit.tsx"),
      "utf8"
    );
    expect(bio).toContain("embedInSection");
    expect(bio).toContain("msqdx-glass-bio-section");
    expect(bio).toContain("msqdx-glass-bio-stack");
    expect(bio).toContain("PersonaV2SectionBlock");
    expect(bio).toContain("MsqdxGlassPainGoalsSectorSeparator");
    expect(bio).toMatch(/embedInSection \? \([\s\S]*msqdx-glass-bio-stack/);
    expect(bio).toContain("embedInParentStack");
    expect(bio).toMatch(/embedInSection && embedInParentStack/);
    expect(bio).toMatch(/if \(embedInSection\)[\s\S]*msqdx-glass-bio-section/);
    expect(bio).toMatch(/MsqdxDashboardCard[\s\S]*id="bio-demographics"/);
  });

  it("passes embedInSection from persona admin panel", () => {
    const panel = readFileSync(
      join(webRoot, "components/msqdx-glass-persona-admin-panel.tsx"),
      "utf8"
    );
    expect(panel).toMatch(
      /showSection\("basics"\)[\s\S]*MsqdxGlassBioCardEdit[\s\S]*embedInParentStack=\{isV2Section\}/
    );
  });

  it("styles bio section in persona v2 panel css", () => {
    const css = readFileSync(join(webRoot, "styles/persona-v2-section-panel.css"), "utf8");
    expect(css).toContain(".msqdx-glass-bio-section");
    expect(css).toContain(".msqdx-glass-bio-stack__block");
  });
});
