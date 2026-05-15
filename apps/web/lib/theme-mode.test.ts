import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isThemeMode, THEME_MODE_STORAGE_KEY, THEME_MODES } from "./theme-mode";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("theme-mode", () => {
  it("recognizes light, dark, and monochrome", () => {
    expect(isThemeMode("light")).toBe(true);
    expect(isThemeMode("dark")).toBe(true);
    expect(isThemeMode("monochrome")).toBe(true);
    expect(isThemeMode("sepia")).toBe(false);
    expect(isThemeMode(null)).toBe(false);
  });

  it("exports stable storage key and mode list", () => {
    expect(THEME_MODE_STORAGE_KEY).toBe("audion-theme-mode");
    expect(THEME_MODES).toEqual(["light", "dark", "monochrome"]);
  });
});

describe("monochrome theme assets", () => {
  it("defines monochrome CSS tokens and border overrides", () => {
    const css = readFileSync(join(webRoot, "styles/monochrome-theme.css"), "utf8");
    expect(css).toContain('[data-theme="monochrome"]');
    expect(css).toContain("--audion-mono-border: #ffffff");
    expect(css).toContain("--audion-mono-page-bg: #000000");
    expect(css).toContain(".msqdx-glass-chip");
    expect(css).toContain(".MuiButton-root");
  });

  it("extends dark selectors to monochrome in global styles", () => {
    const globals = readFileSync(join(webRoot, "styles/globals.css"), "utf8");
    expect(globals).toContain('[data-theme="dark"], [data-theme="monochrome"]');
  });

  it("registers monochrome in theme registry and layout", () => {
    const registry = readFileSync(
      join(webRoot, "components/theme-registry-ssr-safe.tsx"),
      "utf8"
    );
    const layout = readFileSync(join(webRoot, "app/layout.tsx"), "utf8");
    expect(registry).toContain('"monochrome"');
    expect(registry).toContain("monochromeTheme");
    expect(registry).toContain("setThemeMode");
    expect(layout).toContain("monochrome-theme.css");
    expect(layout).toContain('m==="monochrome"');
  });
});
