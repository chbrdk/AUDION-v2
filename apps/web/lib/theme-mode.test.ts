import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  isThemeMode,
  THEME_MODE_STORAGE_KEY,
  THEME_MODES,
  toAdminNavThemeMode,
} from "./theme-mode";

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

  it("maps monochrome to dark for MsqdxAdminNav", () => {
    expect(toAdminNavThemeMode("light")).toBe("light");
    expect(toAdminNavThemeMode("dark")).toBe("dark");
    expect(toAdminNavThemeMode("monochrome")).toBe("dark");
  });
});

describe("monochrome theme assets", () => {
  it("defines monochrome CSS tokens and border overrides", () => {
    const css = readFileSync(join(webRoot, "styles/monochrome-theme.css"), "utf8");
    expect(css).toContain('[data-theme="monochrome"]');
    expect(css).toContain("--audion-mono-border: #ffffff");
    expect(css).toContain(".msqdx-glass-admin-nav");
    expect(css).toContain("--audion-mono-page-bg: #000000");
    expect(css).toContain(".msqdx-glass-chip");
    expect(css).toContain(".MuiButton-root");
    expect(css).toMatch(
      /\[data-theme="monochrome"\] \.msqdx-glass-panel\s*\{[^}]*border:\s*none\s*!important/
    );
  });

  it("keeps admin content absolutely positioned without top/left offsets", () => {
    const layout = readFileSync(
      join(webRoot, "components/admin/msqdx-glass-admin-layout.tsx"),
      "utf8"
    );
    expect(layout).toContain('className="msqdx-glass-admin-content"');
    expect(layout).toContain('position: "absolute"');
    expect(layout).not.toMatch(/msqdx-glass-admin-content[\s\S]*?top:\s*0/);
    expect(layout).not.toMatch(/msqdx-glass-admin-content[\s\S]*?left:\s*0/);
  });

  it("renders glass panels without a border in base styles", () => {
    const globals = readFileSync(join(webRoot, "styles/globals.css"), "utf8");
    expect(globals).toMatch(/\.msqdx-glass-panel\s*\{[^}]*border:\s*none/);
  });

  it("extends dark selectors to monochrome in global styles", () => {
    const globals = readFileSync(join(webRoot, "styles/globals.css"), "utf8");
    expect(globals).toContain(
      '[data-theme="dark"], [data-theme="monochrome"] .msqdx-glass-admin-page'
    );
    expect(globals).toContain("[data-theme=\"dark\"], [data-theme=\"monochrome\"] {");
    expect(globals).not.toMatch(/\[data-theme="dark"\] \{,/);
    expect(globals).not.toMatch(/,, \[data-theme="monochrome"\]/);
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
