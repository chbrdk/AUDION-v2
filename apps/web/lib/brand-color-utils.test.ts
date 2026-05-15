import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("applyMonochromeBrandVars", () => {
  it("uses white chrome surface and black sidebar text in monochrome", () => {
    const source = readFileSync(join(webRoot, "lib/brand-color-utils.ts"), "utf8");
    expect(source).toContain('"--audion-chrome-surface", "#ffffff"');
    expect(source).toContain('"--audion-sidebar-text-color", "#000000"');
    expect(source).toContain('"--color-theme-accent", "#ffffff"');
  });
});
