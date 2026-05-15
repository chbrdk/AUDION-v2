import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("applyMonochromeBrandVars", () => {
  it("uses dark chrome surface for sidebar, white only for accent borders", () => {
    const source = readFileSync(join(webRoot, "lib/brand-color-utils.ts"), "utf8");
    expect(source).toContain('"--audion-light-border-color", "#0a0a0a"');
    expect(source).toContain('"--audion-chrome-surface", "#0a0a0a"');
    expect(source).toContain('"--color-theme-accent", "#ffffff"');
    expect(source).not.toContain('"--audion-light-border-color", "#ffffff"');
  });
});
