import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("persona v2 metadata assignment", () => {
  it("omits read-only audit stats from v2 basics", () => {
    const panel = readFileSync(
      join(webRoot, "components/msqdx-glass-persona-admin-panel.tsx"),
      "utf8"
    );
    expect(panel).toMatch(/!isV2Section \? \([\s\S]*cardId="metadata"[\s\S]*personaAdmin\.confidencePercent/);
    expect(panel).toMatch(
      /MsqdxGlassPersonaBasicsHero[\s\S]*MsqdxGlassPersonaMetadataAssignment/
    );
  });

  it("exposes shared project and target group assignment fields", () => {
    const assignment = readFileSync(
      join(webRoot, "components/personas-v2/msqdx-glass-persona-metadata-assignment.tsx"),
      "utf8"
    );
    expect(assignment).toContain("msqdx-glass-persona-metadata-assignment");
    expect(assignment).toContain("personaAdmin.project");
    expect(assignment).toContain("MsqdxSelect");
    expect(assignment).not.toContain('component="select"');
    expect(assignment).not.toContain("personaAdmin.confidence");
  });

  it("styles metadata assignment as a two-column grid for msqdx selects", () => {
    const css = readFileSync(join(webRoot, "styles/persona-v2-section-panel.css"), "utf8");
    expect(css).toMatch(
      /\.msqdx-glass-persona-metadata-assignment__fields[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/
    );
    expect(css).not.toContain(".msqdx-glass-persona-metadata-assignment__select");
  });
});
