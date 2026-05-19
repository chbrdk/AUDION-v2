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
      /\.msqdx-glass-section-workspace--with-subnav\s*\{[^}]*border:\s*var\(--msqdx-section-workspace-frame-border-width\)\s+solid\s+var\(--msqdx-section-workspace-frame-border\)/
    );
    expect(css).toMatch(
      /\.msqdx-glass-section-workspace--with-subnav\s*\{[^}]*border-radius:\s*var\(--msqdx-section-workspace-frame-radius\)/
    );
    expect(css).toMatch(
      /\.msqdx-glass-section-workspace__dock-shell\s*\{[^}]*border:\s*none/
    );
    const shell = readFileSync(
      resolve(process.cwd(), "components/admin/section-shell/msqdx-glass-section-shell.tsx"),
      "utf8"
    );
    expect(shell).toContain('bgcolor: "transparent"');
    expect(shell).toContain('border: "none"');
  });
});
