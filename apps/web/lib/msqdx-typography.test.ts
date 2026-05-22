import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  MSQDX_MONO_FONT_FAMILY,
  MONO_FONT_SX,
  SECTION_HEADING_MONO_SX,
} from "./msqdx-typography";

describe("msqdx-typography", () => {
  it("exposes mono font via CSS variable", () => {
    expect(MSQDX_MONO_FONT_FAMILY).toBe("var(--msqdx-font-family-mono)");
    expect(MONO_FONT_SX.fontFamily).toBe(MSQDX_MONO_FONT_FAMILY);
  });

  it("defines mono font variable in globals", () => {
    const globals = readFileSync(resolve(process.cwd(), "styles/globals.css"), "utf8");
    expect(globals).toContain("--msqdx-font-family-mono:");
    expect(globals).toContain("--font-ibm-plex-mono");
  });

  it("section heading mono sx uses IBM Plex Mono stack at weight 400", () => {
    expect(SECTION_HEADING_MONO_SX.fontFamily).toBe(MSQDX_MONO_FONT_FAMILY);
    expect(SECTION_HEADING_MONO_SX.fontWeight).toBe(400);
  });
});
