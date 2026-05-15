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
  it("defines inverted monochrome CSS tokens", () => {
    const css = readFileSync(join(webRoot, "styles/monochrome-theme.css"), "utf8");
    expect(css).toContain('[data-theme="monochrome"]');
    expect(css).toContain("--audion-mono-page-bg: #ffffff");
    expect(css).toContain("--audion-mono-canvas-bg: #000000");
    expect(css).toContain("--audion-mono-border: #000000");
    expect(css).toContain("--audion-chrome-surface: #000000");
    expect(css).toContain("--audion-sidebar-text-color: #ffffff");
    expect(css).toMatch(
      /\[data-theme="monochrome"\] body\s*\{[^}]*background-color:\s*var\(--audion-mono-canvas-bg\)/
    );
    expect(css).toMatch(
      /\[data-theme="monochrome"\] \.msqdx-glass-panel\s*\{[^}]*border:\s*none\s*!important/
    );
    expect(css).toMatch(
      /\[data-theme="monochrome"\] \.msqdx-glass-admin-nav[\s\S]*background:[\s\S]*#000000/
    );
    expect(css).toMatch(
      /\[data-theme="monochrome"\] \.msqdx-glass-admin-nav[\s\S]*color:\s*#ffffff/
    );
  });

  it("keeps admin content as a full-bleed scroll container under the header", () => {
    const layout = readFileSync(
      join(webRoot, "components/admin/msqdx-glass-admin-layout.tsx"),
      "utf8"
    );
    expect(layout).toContain('className="msqdx-glass-admin-content"');
    expect(layout).toContain('position: "absolute"');
    expect(layout).toContain("top: 0");
    expect(layout).toContain("left: 0");
    expect(layout).toContain('overflowY: "auto"');
  });

  it("uses white app inner background for monochrome and black for dark", () => {
    const layout = readFileSync(
      join(webRoot, "components/admin/msqdx-glass-admin-layout.tsx"),
      "utf8"
    );
    expect(layout).toContain('const isDarkApp = themeMode === "dark"');
    expect(layout).toContain('? "#ffffff"');
    expect(layout).toContain('isDarkApp\n      ? "#000000"');
    expect(layout).toContain('const appInnerBackground = isMonochrome || isDarkApp ? "default" : "offwhite"');
  });

  it("aligns inverted chrome borders with layout tokens", () => {
    const layout = readFileSync(
      join(webRoot, "components/admin/msqdx-glass-admin-layout.tsx"),
      "utf8"
    );
    expect(layout).toContain('? "#000000"');
    expect(layout).toContain('chromeBorderOnLight = isMonochrome\n    ? "#ffffff"');

    const adminCss = readFileSync(join(webRoot, "styles/admin.css"), "utf8");
    expect(adminCss).toContain(
      '[data-theme="monochrome"] .msqdx-glass-app-layout > div > div:last-of-type > div'
    );
    expect(adminCss).toContain("background-color: #ffffff !important");
    expect(adminCss).toContain("border-color: #000000 !important");
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
  });

  it("registers inverted monochrome MUI theme", () => {
    const registry = readFileSync(
      join(webRoot, "components/theme-registry-ssr-safe.tsx"),
      "utf8"
    );
    expect(registry).toContain('mode: "light"');
    expect(registry).toContain('primary: { main: "#000000"');
    expect(registry).toContain('default: "#ffffff"');
    expect(layoutImportsMonochromeCss());
  });
});

function layoutImportsMonochromeCss(): boolean {
  const layout = readFileSync(join(webRoot, "app/layout.tsx"), "utf8");
  return layout.includes("monochrome-theme.css");
}
