import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("target group v2 sources panel", () => {
  it("merges knowledge and documents in admin panel for v2", () => {
    const panel = readFileSync(
      join(webRoot, "components/msqdx-glass-target-group-admin-panel.tsx"),
      "utf8"
    );
    expect(panel).toContain("MsqdxGlassTargetGroupSourcesPanel");
    expect(panel).toContain('showSection("sources")');
  });

  it("uses sources section id in registry", () => {
    const sections = readFileSync(join(webRoot, "lib/target-group-v2-sections.ts"), "utf8");
    expect(sections).toContain('"sources"');
    expect(sections).not.toContain('id: "documents"');
  });
});
