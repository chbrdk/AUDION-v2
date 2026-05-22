import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("persona v2 workspace content alignment", () => {
  it("bleeds sector separators across dock-shell horizontal padding", () => {
    const css = readFileSync(join(webRoot, "styles/dashboard-cards.css"), "utf8");
    expect(css).toContain(
      ".msqdx-glass-section-workspace__dock-shell .msqdx-glass-pain-goals-sector-separator"
    );
    expect(css).toMatch(
      /\.msqdx-glass-section-workspace__dock-shell \.msqdx-glass-pain-goals-sector-separator[^}]*margin-inline:\s*calc\(-1 \* var\(--msqdx-section-workspace-dock-padding/
    );
    expect(css).toMatch(
      /\.msqdx-glass-section-workspace__dock-shell \.msqdx-glass-pain-goals-sector-separator[^}]*width:\s*calc\(100% \+ 2 \* var\(--msqdx-section-workspace-dock-padding/
    );
    expect(css).not.toMatch(
      /\.msqdx-glass-persona-basics-stack > \.msqdx-glass-pain-goals-sector-separator[^}]*margin-inline:\s*0/
    );
  });

  it("removes extra horizontal padding on v2 detail content wrapper", () => {
    const css = readFileSync(join(webRoot, "styles/persona-v2-section-panel.css"), "utf8");
    expect(css).toMatch(
      /\.msqdx-glass-persona-v2-detail \.msqdx-glass-persona-v2-section-panel[^}]*padding-inline:\s*0/
    );
  });
});
