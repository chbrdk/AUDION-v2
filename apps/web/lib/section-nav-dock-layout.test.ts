import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SECTION_NAV_DOCK_BORDER_RADIUS_PX,
  SECTION_NAV_DOCK_CORNER_STYLES,
  SECTION_NAV_DOCK_SURFACE,
  SECTION_WORKSPACE_DOCK_BORDER_RADIUS_PX,
  SECTION_WORKSPACE_DOCK_CORNER_STYLES,
} from "./section-nav-dock-layout";

describe("section-nav-dock-layout", () => {
  it("uses right-edge cutdowns for left-rail dock", () => {
    expect(SECTION_NAV_DOCK_CORNER_STYLES.topRight).toBe("cutdown-b");
    expect(SECTION_NAV_DOCK_CORNER_STYLES.bottomRight).toBe("cutdown-b");
    expect(SECTION_NAV_DOCK_CORNER_STYLES.topLeft).toBe("rounded");
    expect(SECTION_NAV_DOCK_BORDER_RADIUS_PX).toBe(24);
  });

  it("wraps compact nav in MsqdxCornerBox dock shell", () => {
    const source = readFileSync(
      resolve(process.cwd(), "components/admin/section-shell/msqdx-glass-section-nav.tsx"),
      "utf8"
    );
    expect(source).toContain("MsqdxCornerBox");
    expect(source).toContain("msqdx-glass-section-nav__dock-shell");
    expect(source).toContain("msqdx-glass-section-nav--docked");
    expect(source).toContain("SECTION_NAV_DOCK_CORNER_STYLES");
  });

  it("sizes docked nav to content height without spurious scroll", () => {
    const css = readFileSync(resolve(process.cwd(), "styles/section-shell.css"), "utf8");
    expect(css).toMatch(/\.msqdx-glass-section-nav--docked\s*\{[^}]*height:\s*fit-content/);
    expect(css).toMatch(/\.msqdx-glass-section-nav--docked\s*\{[^}]*max-height:\s*none/);
    expect(css).toMatch(/\.msqdx-glass-section-nav--docked\s*\{[^}]*overflow:\s*visible/);
    expect(css).toMatch(/\.msqdx-glass-section-nav__dock-shell\s*\{[^}]*height:\s*fit-content/);
  });

  it("uses a light tint for dock surface", () => {
    expect(SECTION_NAV_DOCK_SURFACE).toBe("var(--msqdx-section-nav-dock-surface)");
    const css = readFileSync(resolve(process.cwd(), "styles/section-shell.css"), "utf8");
    expect(css).toMatch(
      /--msqdx-section-nav-dock-surface:\s*var\(--color-theme-accent-tint/
    );
  });

  it("mirrors nav cutdowns on the workspace left edge", () => {
    expect(SECTION_WORKSPACE_DOCK_CORNER_STYLES.topLeft).toBe("rounded");
    expect(SECTION_WORKSPACE_DOCK_CORNER_STYLES.bottomLeft).toBe("rounded");
    expect(SECTION_WORKSPACE_DOCK_CORNER_STYLES.topRight).toBe("rounded");
    expect(SECTION_WORKSPACE_DOCK_CORNER_STYLES.bottomRight).toBe("rounded");
    expect(SECTION_WORKSPACE_DOCK_BORDER_RADIUS_PX).toBe(36);
  });

  it("wraps subnav workspace in MsqdxCornerBox dock shell", () => {
    const source = readFileSync(
      resolve(process.cwd(), "components/admin/section-shell/msqdx-glass-section-shell.tsx"),
      "utf8"
    );
    expect(source).toContain("msqdx-glass-section-workspace__dock-shell");
    expect(source).toContain("SECTION_WORKSPACE_DOCK_CORNER_STYLES");
    expect(source).toContain("SECTION_WORKSPACE_DOCK_BORDER_RADIUS_PX");
    const css = readFileSync(resolve(process.cwd(), "styles/section-shell.css"), "utf8");
    expect(css).toMatch(
      /\.msqdx-glass-section-workspace--with-subnav\s*\{[^}]*border:\s*1px solid var\(--msqdx-section-nav-dock-border\)/
    );
  });
});
