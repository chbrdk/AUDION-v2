import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("section-shell layout", () => {
  it("lets workspace content fill the available column width", () => {
    const css = readFileSync(resolve(process.cwd(), "styles/section-shell.css"), "utf8");
    expect(css).toMatch(
      /\.msqdx-glass-section-workspace__content\s*\{[^}]*width:\s*100%/
    );
    expect(css).toMatch(
      /\.msqdx-glass-section-workspace__content\s*\{[^}]*max-width:\s*100%/
    );
    expect(css).not.toMatch(
      /\.msqdx-glass-section-workspace__content\s*\{[^}]*max-width:\s*960px/
    );
    expect(css).toMatch(
      /\.msqdx-glass-section-workspace__dock-shell\s*\{[^}]*background-color:\s*transparent/
    );
    expect(css).toMatch(
      /\.msqdx-glass-section-workspace__dock-shell\s*\{[^}]*border:\s*4px solid var\(--msqdx-section-workspace-dock-border\)/
    );
    expect(css).toMatch(
      /\.msqdx-glass-section-workspace__dock-shell\s*\{[^}]*border-radius:\s*42px/
    );
    const shell = readFileSync(
      resolve(process.cwd(), "components/admin/section-shell/msqdx-glass-section-shell.tsx"),
      "utf8"
    );
    expect(shell).toContain('bgcolor: "transparent"');
  });
});
