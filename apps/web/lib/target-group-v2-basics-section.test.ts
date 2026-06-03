import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { targetGroupV2PersonaDetailHref } from "./target-group-v2-persona-link";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("target group v2 basics section", () => {
  it("links personas from TG admin to personas v2 basics", () => {
    expect(targetGroupV2PersonaDetailHref("abc-123")).toBe("/admin/personas-v2/abc-123/basics");
  });

  it("uses standard entity editor for basics in admin panel", () => {
    const panel = readFileSync(
      join(webRoot, "components/msqdx-glass-target-group-admin-panel.tsx"),
      "utf8"
    );
    expect(panel).toContain("MsqdxGlassEntityEditor");
    expect(panel).toContain("alwaysEditMode={isV2Section}");
    expect(panel).toContain("bilingualColumns={isV2Section}");
    expect(panel).not.toContain("MsqdxGlassTargetGroupBasicsHero");
    expect(panel).not.toContain("MsqdxGlassTargetGroupBasicsLocalization");
    expect(panel).toContain("targetGroupV2PersonaDetailHref");
  });

  it("persona list accepts custom detail href", () => {
    const list = readFileSync(join(webRoot, "components/msqdx-glass-persona-list.tsx"), "utf8");
    expect(list).toContain("getPersonaDetailHref");
  });
});
