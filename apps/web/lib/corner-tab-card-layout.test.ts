import { describe, expect, it } from "vitest";
import {
  CORNER_TAB_CARD_DEFAULTS,
  getCornerTabCardLayout,
} from "./corner-tab-card-layout";

describe("corner-tab-card-layout", () => {
  it("top-right tab uses cutdown-a on bottom-left for body join", () => {
    const layout = getCornerTabCardLayout({ placement: "top-right" });
    expect(layout.cornerStyles.bottomLeft).toBe("cutdown-a");
    expect(layout.cornerStyles.bottomRight).toBe("square");
    expect(layout.cornerBoxSx).not.toHaveProperty("borderRadius");
    expect(CORNER_TAB_CARD_DEFAULTS.cornerBoxWidthExtraPx).toBe(14);
  });

  it("expands tab width for icon + toolbar content", () => {
    const layout = getCornerTabCardLayout({ placement: "top-right", tabWidthAuto: true });
    expect(layout.tabContainerSx).toMatchObject({
      width: "max-content",
      minWidth: 48,
      top: "-48px",
    });
    expect(layout.tabContainerSx).toMatchObject({ pointerEvents: "auto", minHeight: 40 });
    expect(layout.cornerBoxSx).toMatchObject({
      width: "fit-content",
      minHeight: 40,
      py: 0.5,
      px: 1,
    });
  });
});
