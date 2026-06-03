import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SECTION_NAV_DOCK_BORDER_RADIUS_PX,
  SECTION_NAV_DOCK_CORNER_STYLES,
  SECTION_NAV_HORIZONTAL_ACTIVE_CORNER_STYLES,
  SECTION_NAV_HORIZONTAL_DOCK_BORDER_RADIUS_PX,
  SECTION_NAV_HORIZONTAL_DOCK_CORNER_STYLES,
  SECTION_NAV_HORIZONTAL_MEDIA_QUERY,
  SECTION_NAV_HORIZONTAL_WORKSPACE_OVERLAP_PX,
  SECTION_WORKSPACE_DOCK_BORDER_RADIUS_PX,
  SECTION_WORKSPACE_DOCK_CORNER_STYLES,
  SECTION_NAV_RAIL_WITH_ENTITY_ACCENT_MAX_PX,
  SECTION_WORKSPACE_DOCK_PADDING,
} from "./section-nav-dock-layout";

describe("section-nav-dock-layout", () => {
  it("widens nav rail when entity accent is in nav column", () => {
    const css = readFileSync(resolve(process.cwd(), "styles/section-shell.css"), "utf8");
    expect(SECTION_NAV_RAIL_WITH_ENTITY_ACCENT_MAX_PX).toBe(280);
    expect(css).toMatch(
      new RegExp(
        `grid-template-columns:\\s*minmax\\(240px,\\s*${SECTION_NAV_RAIL_WITH_ENTITY_ACCENT_MAX_PX}px\\)`
      )
    );
  });

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
    expect(source).toContain("msqdx-glass-section-nav--horizontal");
    expect(source).toContain("msqdx-glass-section-nav__card-active-shell");
    expect(source).toContain("SECTION_NAV_DOCK_CORNER_STYLES");
    expect(source).toContain("SECTION_NAV_HORIZONTAL_ACTIVE_CORNER_STYLES");
    expect(source).toContain("SECTION_NAV_HORIZONTAL_MEDIA_QUERY");
    expect(source).toContain("SECTION_NAV_HORIZONTAL_DOCK_BORDER_RADIUS_PX");
    expect(source).toContain("dockBorderRadiusPx");
    expect(source).toContain("scrollIntoView");
    expect(source).toContain("SECTION_NAV_DOCK_TRACK_CLASS");
    expect(source).toContain('flexDirection: isHorizontal ? "row" : "column"');
    expect(source).toContain("py: isHorizontal ? 0 : theme.spacing(0.75)");
  });

  it("uses top- and bottom-edge cutdown corners for active tab in horizontal mode", () => {
    expect(SECTION_NAV_HORIZONTAL_ACTIVE_CORNER_STYLES.bottomLeft).toBe("cutdown-a");
    expect(SECTION_NAV_HORIZONTAL_ACTIVE_CORNER_STYLES.bottomRight).toBe("cutdown-a");
    expect(SECTION_NAV_HORIZONTAL_ACTIVE_CORNER_STYLES.topLeft).toBe("cutdown-a");
    expect(SECTION_NAV_HORIZONTAL_ACTIVE_CORNER_STYLES.topRight).toBe("cutdown-a");
    expect(SECTION_NAV_HORIZONTAL_DOCK_CORNER_STYLES.bottomLeft).toBe("rounded");
    expect(SECTION_NAV_HORIZONTAL_DOCK_BORDER_RADIUS_PX).toBe(36);
  });

  it("uses theme accent tokens for active dock row surface and contrast text", () => {
    const css = readFileSync(resolve(process.cwd(), "styles/section-shell.css"), "utf8");
    expect(css).toMatch(
      /--msqdx-section-nav-active-card-surface:\s*var\(--color-theme-accent/
    );
    expect(css).toMatch(
      /--msqdx-section-nav-active-card-on-surface:\s*var\(--color-theme-accent-contrast/
    );
    expect(css).toContain(
      "color: var(--msqdx-section-nav-active-card-on-surface) !important"
    );
    expect(css).toMatch(
      /\.msqdx-glass-section-nav__icon\s*\.msqdx-material-symbol[\s\S]*?color:\s*var\(--msqdx-section-nav-active-card-on-surface\)\s*!important/s
    );
    expect(css).toMatch(
      /\/\* Docked compact: active link has no border[\s\S]*?\.msqdx-glass-section-nav--docked[\s\S]*?\.msqdx-glass-section-nav__card--active\s*\{[\s\S]*?border:\s*none/
    );
  });

  it("sizes docked nav to content height without spurious scroll", () => {
    const css = readFileSync(resolve(process.cwd(), "styles/section-shell.css"), "utf8");
    expect(css).toMatch(/\.msqdx-glass-section-nav--docked\s*\{[^}]*height:\s*fit-content/);
    expect(css).toMatch(/\.msqdx-glass-section-nav--docked\s*\{[^}]*max-height:\s*none/);
    expect(css).toMatch(/\.msqdx-glass-section-nav--docked\s*\{[^}]*overflow:\s*visible/);
    expect(css).toMatch(/\.msqdx-glass-section-nav__dock-shell\s*\{[^}]*height:\s*fit-content/);
    expect(css).toMatch(
      /max-width:\s*1024px[\s\S]*\.msqdx-glass-section-nav__dock-track[\s\S]*flex-direction:\s*row/
    );
    expect(css).toMatch(
      /max-width:\s*1024px[\s\S]*\.msqdx-glass-section-nav__dock-track[\s\S]*scroll-snap-type:\s*x/
    );
    expect(css).not.toMatch(
      /max-width:\s*1024px[\s\S]*\.msqdx-glass-section-workspace--with-subnav[\s\S]*border-top-left-radius:\s*0/
    );
    expect(SECTION_NAV_HORIZONTAL_WORKSPACE_OVERLAP_PX).toBe(0);
    expect(css).toContain("--msqdx-section-nav-horizontal-workspace-overlap: 0px");
    expect(css).toMatch(
      /max-width:\s*1024px[\s\S]*\.msqdx-glass-section-nav--horizontal[\s\S]*margin-bottom:\s*0/
    );
    expect(css).toMatch(
      /max-width:\s*1024px[\s\S]*\.msqdx-glass-section-nav--horizontal\s+\.msqdx-glass-section-nav__dock-track[\s\S]*padding-block:\s*0/
    );
    expect(css).toMatch(
      /max-width:\s*1024px[\s\S]*\.msqdx-glass-section-nav--horizontal\s+\.msqdx-glass-section-nav__dock-track[\s\S]*scrollbar-width:\s*none/
    );
    expect(css).toMatch(
      /max-width:\s*1024px[\s\S]*\.msqdx-glass-section-nav--horizontal\s+\.msqdx-glass-section-nav__dock-track::-webkit-scrollbar[\s\S]*display:\s*none/
    );
    expect(css).toContain("--msqdx-section-nav-dock-border-radius");
    expect(css).toContain("--msqdx-section-nav-horizontal-dock-border-radius");
    expect(css).toMatch(
      /max-width:\s*1024px[\s\S]*\.msqdx-glass-section-nav--horizontal[\s\S]*border-radius:\s*var\(--msqdx-section-nav-horizontal-dock-border-radius\)/
    );
    expect(css).toMatch(
      /max-width:\s*1024px[\s\S]*\.msqdx-glass-section-nav--horizontal\s+\.msqdx-glass-section-nav__dock-shell[\s\S]*border-radius:\s*var\(--msqdx-section-nav-horizontal-dock-border-radius\)/
    );
    expect(css).toMatch(
      /max-width:\s*1024px[\s\S]*\.msqdx-glass-section-nav--horizontal\s+\.msqdx-glass-section-nav__card[\s\S]*border-radius:\s*var\(--msqdx-section-nav-horizontal-dock-border-radius\)/
    );
  });

  it("keeps nav dock shell background unset", () => {
    const source = readFileSync(
      resolve(process.cwd(), "components/admin/section-shell/msqdx-glass-section-nav.tsx"),
      "utf8"
    );
    expect(source).not.toContain("SECTION_NAV_DOCK_SURFACE");
    expect(source).not.toMatch(/msqdx-glass-section-nav__dock-shell[\s\S]*?bgcolor:/);
    const css = readFileSync(resolve(process.cwd(), "styles/section-shell.css"), "utf8");
    expect(css).toMatch(
      /\.msqdx-glass-section-nav__dock-shell\s*\{[^}]*background:\s*unset/
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
    expect(source).toContain("SECTION_WORKSPACE_DOCK_PADDING");
    expect(SECTION_WORKSPACE_DOCK_PADDING).toContain("--msqdx-spacing-lg");
    const css = readFileSync(resolve(process.cwd(), "styles/section-shell.css"), "utf8");
    expect(css).toContain("--msqdx-section-workspace-dock-padding");
    expect(css).toMatch(
      /\.msqdx-glass-section-workspace--with-subnav\s*\{[^}]*border:\s*var\(--msqdx-section-workspace-frame-border-width\)\s+solid\s+var\(--msqdx-section-workspace-frame-border\)/
    );
  });
});
