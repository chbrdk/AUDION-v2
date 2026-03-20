import { describe, expect, it } from "vitest";
import { PAGE_SPEC_VERSION, parsePageSpec, safeParsePageSpec, PAGE_BLOCK_TYPES } from "./index.js";

describe("page-spec", () => {
  it("parses minimal valid PageSpec", () => {
    const spec = parsePageSpec({
      title: "Demo",
      blocks: [
        {
          type: "hero",
          title: "Hello",
        },
      ],
    });
    expect(spec.version).toBe(PAGE_SPEC_VERSION);
    expect(spec.blocks[0]?.type).toBe("hero");
  });

  it("rejects unknown block type", () => {
    const r = safeParsePageSpec({
      title: "X",
      blocks: [{ type: "unknown", foo: 1 }],
    });
    expect(r.success).toBe(false);
  });

  it("lists eight block types", () => {
    expect(PAGE_BLOCK_TYPES.length).toBe(8);
  });

  it("accepts optional render and block hints", () => {
    const spec = parsePageSpec({
      title: "Hints",
      render: {
        componentLibrary: "porsche",
        renderMode: "production",
        stylePreset: "neobrutalism",
      },
      blocks: [
        {
          type: "hero",
          title: "H",
          variant: "heroA",
          density: "comfortable",
          themeIntent: "bold",
          componentHints: ["PorscheHero", "PrimaryCta"],
        },
      ],
    });
    expect(spec.render?.componentLibrary).toBe("porsche");
    expect(spec.blocks[0]?.variant).toBe("heroA");
  });
});
