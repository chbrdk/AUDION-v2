import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("monochrome brand vars", () => {
  it("defines dark and light monochrome runtime palettes", () => {
    const source = readFileSync(join(webRoot, "lib/brand-color-utils.ts"), "utf8");
    expect(source).toContain("applyMonochromeDarkBrandVars");
    expect(source).toContain("applyMonochromeLightBrandVars");
    expect(source).toContain('"--audion-chrome-surface", "#ffffff"');
    expect(source).toContain('"--audion-sidebar-text-color", "#000000"');
    expect(source).toContain('"--audion-chrome-surface", "#000000"');
    expect(source).toContain('"--audion-sidebar-text-color", "#ffffff"');
  });
});
