import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("persona v2 basics flat section", () => {
  it("uses PersonaAdminSectionSurface with embedInSection for basics blocks", () => {
    const panel = readFileSync(
      join(webRoot, "components/msqdx-glass-persona-admin-panel.tsx"),
      "utf8"
    );
    expect(panel).toContain("msqdx-glass-persona-basics-section");
    expect(panel).toContain("msqdx-glass-persona-basics-stack");
    expect(panel).toContain("PersonaAdminSectionSurface");
    expect(panel).toContain("hideBlockTitle={isV2Section}");
    expect(panel).toContain("MsqdxGlassPersonaBasicsHero");
    expect(panel).toContain("MsqdxGlassPersonaMetadataAssignment");
    expect(panel).toMatch(
      /isV2Section \? \([\s\S]*MsqdxGlassPersonaBasicsHero[\s\S]*MsqdxGlassPersonaMetadataAssignment/
    );
    expect(panel).toMatch(/!isV2Section \? \([\s\S]*cardId="metadata"/);
    expect(panel).toMatch(
      /cardId="integrations"[\s\S]*embedInSection=\{isV2Section\}/
    );
    expect(panel).toMatch(
      /showSection\("basics"\)[\s\S]*cardId="integrations"[\s\S]*<\/Stack>/
    );
    expect(panel).not.toMatch(
      /showSection\("basics"\)[\s\S]*MsqdxDashboardCard[\s\S]*id="persona-basics"/
    );
    expect(panel).toMatch(
      /showSection\("basics"\)[\s\S]*MsqdxGlassBioCardEdit[\s\S]*embedInParentStack=\{isV2Section\}/
    );
    expect(panel).not.toContain('showSection("bio")');
  });

  it("styles basics section with design tokens", () => {
    const css = readFileSync(join(webRoot, "styles/persona-v2-section-panel.css"), "utf8");
    expect(css).toContain(".msqdx-glass-persona-basics-section");
    expect(css).toContain(".msqdx-glass-persona-basics-section__name");
    expect(css).toMatch(
      /\.msqdx-glass-persona-v2-section-panel \.msqdx-glass-dashboard-grid--v2-section[^}]*gap:\s*var\(--msqdx-spacing-lg\)/
    );
  });

  it("omits duplicate workspace section header (nav labels sections)", () => {
    const layout = readFileSync(
      join(webRoot, "components/personas-v2/msqdx-glass-persona-v2-detail-layout.tsx"),
      "utf8"
    );
    expect(layout).not.toContain("sectionTitle=");
    expect(layout).not.toContain("sectionDescription=");
  });
});
