import { describe, expect, it } from "vitest";
import {
  CORNER_TAB_CARD_DEFAULTS,
  getCornerTabCardLayout,
} from "./corner-tab-card-layout";

describe("corner-tab-card-layout", () => {
  it("top-right tab has square bottom-left (no radius on body join)", () => {
    const layout = getCornerTabCardLayout({ placement: "top-right" });
    expect(layout.cornerStyles.bottomLeft).toBe("square");
    expect(layout.cornerBoxSx).not.toHaveProperty("borderRadius");
    expect(CORNER_TAB_CARD_DEFAULTS.cornerBoxWidthExtraPx).toBe(14);
  });

  it("expands tab width for icon + toolbar content", () => {
    const layout = getCornerTabCardLayout({ placement: "top-right", tabWidthAuto: true });
    expect(layout.tabContainerSx).toMatchObject({ width: "max-content", minWidth: 48 });
    expect(layout.tabContainerSx).toMatchObject({ pointerEvents: "auto" });
  });
});
