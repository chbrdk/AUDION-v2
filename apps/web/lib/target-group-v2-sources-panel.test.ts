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

  it("renders documents and knowledge with PersonaV2SectionBlock headings", () => {
    const panel = readFileSync(
      join(webRoot, "components/target-groups-v2/msqdx-glass-target-group-sources-panel.tsx"),
      "utf8"
    );
    expect(panel).toContain("PersonaV2SectionBlock");
    expect(panel).toContain("documentsHeading");
    expect(panel).toContain("knowledgeHeading");
    expect(panel).not.toContain("tgV2SectionCaptionSx");
  });
});
