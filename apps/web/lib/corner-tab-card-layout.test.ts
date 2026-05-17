import { describe, expect, it } from "vitest";
import {
  CORNER_TAB_CARD_DEFAULTS,
  getCornerTabCardLayout,
} from "./corner-tab-card-layout";

describe("corner-tab-card-layout", () => {
  it("top-right mirrors cutdown to bottom-left", () => {
    const layout = getCornerTabCardLayout({ placement: "top-right" });
    expect(layout.cornerStyles.bottomLeft).toBe("cutdown-a");
    expect(CORNER_TAB_CARD_DEFAULTS.cornerBoxWidthExtraPx).toBe(14);
  });
});
