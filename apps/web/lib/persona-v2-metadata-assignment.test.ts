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
      /msqdx-glass-persona-basics-section__assignment[\s\S]*MsqdxGlassPersonaMetadataAssignment/
    );
  });

  it("exposes shared project and target group assignment fields", () => {
    const assignment = readFileSync(
      join(webRoot, "components/personas-v2/msqdx-glass-persona-metadata-assignment.tsx"),
      "utf8"
    );
    expect(assignment).toContain("msqdx-glass-persona-metadata-assignment");
    expect(assignment).toContain("personaAdmin.project");
    expect(assignment).not.toContain("personaAdmin.confidence");
  });
});
