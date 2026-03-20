import { assign } from "./helpers";

describe("assign", () => {
  it("skips __htmlFigma* transport keys (Figma nodes are not extensible)", () => {
    const target: Record<string, unknown> = {};
    assign(target as any, {
      name: "Frame",
      visible: true,
      __htmlFigmaLayoutMeta: { figmaAutoLayout: { layoutMode: "HORIZONTAL" } },
      __htmlFigmaPendingNormalize: true,
    } as any);

    expect(target.name).toBe("Frame");
    expect(target.visible).toBe(true);
    expect(target.__htmlFigmaLayoutMeta).toBeUndefined();
    expect(target.__htmlFigmaPendingNormalize).toBeUndefined();
  });
});
