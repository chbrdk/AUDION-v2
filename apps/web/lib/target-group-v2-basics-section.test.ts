import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { targetGroupV2PersonaDetailHref } from "./target-group-basics-hero-layout";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const knowledgeRoot = join(webRoot, "..", "..", "knowledge");

describe("target group v2 basics section", () => {
  it("links personas from TG admin to personas v2 basics", () => {
    expect(targetGroupV2PersonaDetailHref("abc-123")).toBe("/admin/personas-v2/abc-123/basics");
  });

  it("uses basics hero stack with sector separators in admin panel", () => {
    const panel = readFileSync(
      join(webRoot, "components/msqdx-glass-target-group-admin-panel.tsx"),
      "utf8"
    );
    expect(panel).toContain("MsqdxGlassTargetGroupBasicsHero");
    expect(panel).toContain("msqdx-glass-target-group-basics-stack");
    expect(panel).toContain("MsqdxGlassPainGoalsSectorSeparator");
    expect(panel).toContain("targetGroupV2PersonaDetailHref");
  });

  it("persona list accepts custom detail href", () => {
    const list = readFileSync(join(webRoot, "components/msqdx-glass-persona-list.tsx"), "utf8");
    expect(list).toContain("getPersonaDetailHref");
  });

  it("documents basics hero in TG v2 blueprint", () => {
    const doc = readFileSync(join(knowledgeRoot, "target-group-v2-design-blueprint.md"), "utf8");
    expect(doc).toContain("MsqdxGlassTargetGroupBasicsHero");
    expect(doc).toContain("MsqdxGlassPainGoalsSectorSeparator");
  });
});
