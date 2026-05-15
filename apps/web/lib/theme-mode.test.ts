import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  isMonochromeMode,
  isThemeMode,
  normalizeThemeMode,
  THEME_MODE_STORAGE_KEY,
  THEME_MODES,
  toAdminNavThemeMode,
} from "./theme-mode";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("theme-mode", () => {
  it("recognizes light, dark, and both monochrome variants", () => {
    expect(isThemeMode("light")).toBe(true);
    expect(isThemeMode("dark")).toBe(true);
    expect(isThemeMode("monochrome-dark")).toBe(true);
    expect(isThemeMode("monochrome-light")).toBe(true);
    expect(isThemeMode("monochrome")).toBe(false);
    expect(isThemeMode("sepia")).toBe(false);
    expect(isThemeMode(null)).toBe(false);
  });

  it("migrates legacy monochrome storage to monochrome-dark", () => {
    expect(normalizeThemeMode("monochrome")).toBe("monochrome-dark");
    expect(normalizeThemeMode("monochrome-light")).toBe("monochrome-light");
  });

  it("exports stable storage key and mode list", () => {
    expect(THEME_MODE_STORAGE_KEY).toBe("audion-theme-mode");
    expect(THEME_MODES).toEqual(["light", "dark", "monochrome-dark", "monochrome-light"]);
  });

  it("maps monochrome variants for MsqdxAdminNav", () => {
    expect(toAdminNavThemeMode("monochrome-dark")).toBe("light");
    expect(toAdminNavThemeMode("monochrome-light")).toBe("dark");
  });

  it("detects monochrome modes", () => {
    expect(isMonochromeMode("monochrome-dark")).toBe(true);
    expect(isMonochromeMode("monochrome-light")).toBe(true);
    expect(isMonochromeMode("dark")).toBe(false);
  });
});

describe("monochrome theme assets", () => {
  it("defines separate dark and light token blocks", () => {
    const css = readFileSync(join(webRoot, "styles/monochrome-theme.css"), "utf8");
    expect(css).toContain('[data-theme="monochrome-dark"]');
    expect(css).toContain('[data-theme="monochrome-light"]');
    expect(css).toContain("--audion-mono-page-bg: #000000");
    expect(css).toContain("--audion-mono-canvas-bg: #ffffff");
    expect(css).toMatch(
      /\[data-theme="monochrome-light"\][\s\S]*--audion-mono-page-bg:\s*#ffffff/
    );
    expect(css).toMatch(
      /\[data-theme="monochrome-light"\][\s\S]*--audion-mono-canvas-bg:\s*#000000/
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

  it("uses black inner background for monochrome-dark and white for monochrome-light", () => {
    const layout = readFileSync(
      join(webRoot, "components/admin/msqdx-glass-admin-layout.tsx"),
      "utf8"
    );
    expect(layout).toContain('themeMode === "monochrome-dark"');
    expect(layout).toContain('themeMode === "monochrome-light"');
    expect(layout).toContain('? "#000000"');
    expect(layout).toContain('? "#ffffff"');
  });

  it("splits app frame borders per monochrome variant in admin.css", () => {
    const adminCss = readFileSync(join(webRoot, "styles/admin.css"), "utf8");
    expect(adminCss).toContain('[data-theme="monochrome-dark"] .msqdx-glass-app-layout');
    expect(adminCss).toContain("border-color: #ffffff !important");
    expect(adminCss).toContain('[data-theme="monochrome-light"] .msqdx-glass-app-layout');
    expect(adminCss).toContain("border-color: #000000 !important");
  });

  it("registers separate MUI themes for both monochrome variants", () => {
    const registry = readFileSync(
      join(webRoot, "components/theme-registry-ssr-safe.tsx"),
      "utf8"
    );
    expect(registry).toContain("monochromeDarkTheme");
    expect(registry).toContain("monochromeLightTheme");
    expect(registry).toContain('mode: "dark"');
    expect(registry).toContain('primary: { main: "#ffffff"');
    expect(registry).toContain('primary: { main: "#000000"');
  });
});
