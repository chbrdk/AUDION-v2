import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("applyMonochromeBrandVars", () => {
  it("uses inverted monochrome chrome: black canvas/sidebar, white content accents", () => {
    const source = readFileSync(join(webRoot, "lib/brand-color-utils.ts"), "utf8");
    expect(source).toContain('"--audion-chrome-surface", "#000000"');
    expect(source).toContain('"--audion-light-html-background-color", "#000000"');
    expect(source).toContain('"--audion-sidebar-text-color", "#ffffff"');
    expect(source).toContain('"--color-theme-accent", "#000000"');
    expect(source).toContain('"--color-theme-accent-contrast", "#ffffff"');
  });
});
