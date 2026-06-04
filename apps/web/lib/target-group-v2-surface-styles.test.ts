import { describe, expect, it } from "vitest";
import { TG_V2_SURFACE_CLASS } from "./target-group-v2-surface-styles";

describe("target-group-v2-surface-styles", () => {
  it("exposes stable surface class names", () => {
    expect(TG_V2_SURFACE_CLASS.card).toBe("msqdx-tg-v2-surface-card");
    expect(TG_V2_SURFACE_CLASS.create).toBe("msqdx-tg-v2-surface-create");
    expect(TG_V2_SURFACE_CLASS.listRow).toBe("msqdx-tg-v2-surface-list-row");
  });
});
