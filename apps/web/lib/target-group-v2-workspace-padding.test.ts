import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("target group v2 workspace content alignment", () => {
  it("bleeds sector separators across dock-shell horizontal padding", () => {
    const css = readFileSync(join(webRoot, "styles/dashboard-cards.css"), "utf8");
    expect(css).toContain(
      ".msqdx-glass-section-workspace__dock-shell .msqdx-glass-pain-goals-sector-separator"
    );
    expect(css).toMatch(
      /\.msqdx-glass-section-workspace__dock-shell \.msqdx-glass-pain-goals-sector-separator[^}]*margin-inline:\s*calc\(-1 \* var\(--msqdx-section-workspace-dock-padding/
    );
  });

  it("wraps basics in a full-width stack like persona v2", () => {
    const panel = readFileSync(
      join(webRoot, "components/msqdx-glass-target-group-admin-panel.tsx"),
      "utf8"
    );
    expect(panel).toContain("msqdx-glass-target-group-basics-stack");
    expect(panel).toContain("MsqdxGlassPainGoalsSectorSeparator");
  });

  it("removes extra horizontal padding on v2 detail content wrapper", () => {
    const css = readFileSync(join(webRoot, "styles/target-group-v2-section-panel.css"), "utf8");
    expect(css).toMatch(
      /\.msqdx-glass-target-group-v2-detail \.msqdx-glass-target-group-v2-section-panel[^}]*padding-inline:\s*0/
    );
  });
});
