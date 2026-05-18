import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SECTION_NAV_DOCK_BORDER_RADIUS_PX,
  SECTION_NAV_DOCK_CORNER_STYLES,
} from "./section-nav-dock-layout";

describe("section-nav-dock-layout", () => {
  it("uses right-edge cutdowns for left-rail dock", () => {
    expect(SECTION_NAV_DOCK_CORNER_STYLES.topRight).toBe("cutdown-a");
    expect(SECTION_NAV_DOCK_CORNER_STYLES.bottomRight).toBe("cutdown-a");
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
});
