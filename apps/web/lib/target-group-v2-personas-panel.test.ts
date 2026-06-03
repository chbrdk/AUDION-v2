import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("target group v2 personas panel", () => {
  it("wires v2 personas panel with layout toggle and AI generate", () => {
    const panel = readFileSync(
      join(webRoot, "components/msqdx-glass-target-group-admin-panel.tsx"),
      "utf8"
    );
    const personasPanel = readFileSync(
      join(webRoot, "components/target-groups-v2/msqdx-glass-target-group-personas-panel.tsx"),
      "utf8"
    );
    expect(panel).toContain("MsqdxGlassTargetGroupPersonasPanel");
    expect(personasPanel).toContain("PersonasOverviewLayoutToggle");
    expect(personasPanel).toContain("auto_awesome");
    expect(personasPanel).toContain("generateWithAiTitle");
  });
});
