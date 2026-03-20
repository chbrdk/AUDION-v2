import {
  HTML_FIGMA_LAYOUT_META_KEY,
  HTML_FIGMA_PENDING_LAYOUT_POSITIONING_KEY,
  peelFrameLayoutMeta,
  peelDeferredLayoutPositioning,
  getFrameLayoutMeta,
  clearFrameLayoutMeta,
  applyAutoLayoutToFrame,
  layerJsonSubtreeHasRotation,
  type FigmaAutoLayoutPayload,
} from "./apply-auto-layout";

describe("apply-auto-layout (meta + padding)", () => {
  it("peelFrameLayoutMeta moves keys off layer and stores internal bag", () => {
    const layer: Record<string, unknown> = {
      x: 0,
      figmaAutoLayout: {
        layoutMode: "HORIZONTAL",
        primaryAxisAlignItems: "MIN",
        counterAxisAlignItems: "MIN",
        paddingTop: 1,
        paddingRight: 2,
        paddingBottom: 3,
        paddingLeft: 4,
        itemSpacing: 8,
      } satisfies FigmaAutoLayoutPayload,
      figmaFlexWrapRows: [[0, 1]],
    };

    peelFrameLayoutMeta(layer);
    expect(layer.figmaAutoLayout).toBeUndefined();
    expect(layer.figmaFlexWrapRows).toBeUndefined();
    const bag = getFrameLayoutMeta(layer);
    expect(bag?.figmaAutoLayout?.layoutMode).toBe("HORIZONTAL");
    expect(bag?.figmaFlexWrapRows).toEqual([[0, 1]]);
    clearFrameLayoutMeta(layer);
    expect(layer[HTML_FIGMA_LAYOUT_META_KEY]).toBeUndefined();
  });

  it("applyAutoLayoutToFrame sets padding and layout fields on a frame-like object", () => {
    const frame = {
      paddingTop: 0,
      paddingRight: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      layoutMode: "NONE" as const,
      primaryAxisAlignItems: "MIN" as const,
      counterAxisAlignItems: "MIN" as const,
      itemSpacing: 0,
      layoutWrap: "NO_WRAP" as const,
      primaryAxisSizingMode: "AUTO" as const,
      counterAxisSizingMode: "AUTO" as const,
    };

    applyAutoLayoutToFrame(frame as unknown as FrameNode, {
      layoutMode: "VERTICAL",
      primaryAxisAlignItems: "CENTER",
      counterAxisAlignItems: "MAX",
      paddingTop: 3,
      paddingRight: 4,
      paddingBottom: 5,
      paddingLeft: 6,
      itemSpacing: 12,
      counterAxisSpacing: 10,
      layoutWrap: "WRAP",
      primaryAxisSizingMode: "FIXED",
      counterAxisSizingMode: "AUTO",
    });

    expect(frame.paddingTop).toBe(3);
    expect(frame.layoutMode).toBe("VERTICAL");
    expect(frame.itemSpacing).toBe(12);
    expect(frame.layoutWrap).toBe("WRAP");
    expect((frame as { counterAxisSpacing?: number | null }).counterAxisSpacing).toBe(10);
  });

  it("NO_WRAP clears counterAxisSpacing", () => {
    const frame = {
      paddingTop: 0,
      paddingRight: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      layoutMode: "HORIZONTAL" as const,
      primaryAxisAlignItems: "MIN" as const,
      counterAxisAlignItems: "MIN" as const,
      itemSpacing: 8,
      layoutWrap: "NO_WRAP" as const,
      counterAxisSpacing: 99 as number | null,
    };

    applyAutoLayoutToFrame(frame as unknown as FrameNode, {
      layoutMode: "HORIZONTAL",
      primaryAxisAlignItems: "MIN",
      counterAxisAlignItems: "MIN",
      paddingTop: 0,
      paddingRight: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      itemSpacing: 8,
      layoutWrap: "NO_WRAP",
    });

    expect(frame.counterAxisSpacing).toBeNull();
  });

  it("deferPrimaryLayout only applies padding", () => {
    const frame = {
      paddingTop: 0,
      paddingRight: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      layoutMode: "NONE" as const,
    };

    applyAutoLayoutToFrame(
      frame as unknown as FrameNode,
      {
        layoutMode: "HORIZONTAL",
        primaryAxisAlignItems: "MIN",
        counterAxisAlignItems: "MIN",
        paddingTop: 2,
        paddingRight: 0,
        paddingBottom: 0,
        paddingLeft: 0,
        itemSpacing: 0,
      },
      { deferPrimaryLayout: true }
    );

    expect(frame.paddingTop).toBe(2);
    expect(frame.layoutMode).toBe("NONE");
  });

  it("peelDeferredLayoutPositioning moves ABSOLUTE off layer for deferred assign", () => {
    const layer: Record<string, unknown> = {
      layoutPositioning: "ABSOLUTE",
      name: "overlay",
    };
    peelDeferredLayoutPositioning(layer);
    expect(layer.layoutPositioning).toBeUndefined();
    expect(layer[HTML_FIGMA_PENDING_LAYOUT_POSITIONING_KEY]).toBe("ABSOLUTE");
  });

  it("layerJsonSubtreeHasRotation detects nested rotation", () => {
    expect(
      layerJsonSubtreeHasRotation({
        type: "FRAME",
        children: [{ type: "RECTANGLE", rotation: 12, children: [] }],
      } as Record<string, unknown>)
    ).toBe(true);
    expect(
      layerJsonSubtreeHasRotation({ type: "FRAME", children: [] } as Record<string, unknown>)
    ).toBe(false);
  });
});
