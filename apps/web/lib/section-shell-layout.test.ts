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
  });
});
