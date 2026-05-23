import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isMsqdxGlassPersonaChipVariant } from "../components/msqdx/chip";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("MsqdxGlassPersonaChip", () => {
  it("recognizes persona admin chip variants", () => {
    expect(isMsqdxGlassPersonaChipVariant("trait")).toBe(true);
    expect(isMsqdxGlassPersonaChipVariant("vocab")).toBe(true);
    expect(isMsqdxGlassPersonaChipVariant("draft")).toBe(false);
  });

  it("exposes interactive chip with double-click edit", () => {
    const chip = readFileSync(
      join(webRoot, "components/msqdx/chip/msqdx-glass-persona-chip.tsx"),
      "utf8"
    );
    expect(chip).toContain("MsqdxGlassPersonaChip");
    expect(chip).toContain("onRequestEdit");
    expect(chip).toContain('interactive={interactive}');
    expect(chip).toContain("onDoubleClick");
  });

  it("wires chip editor to persona chip and beginChipEdit", () => {
    const editor = readFileSync(
      join(webRoot, "components/generic/msqdx-glass-chip-editor.tsx"),
      "utf8"
    );
    expect(editor).toContain("MsqdxGlassPersonaChip");
    expect(editor).toContain("beginChipEdit");
    expect(editor).toContain("onRequestEdit={() => beginChipEdit(idx, chip)}");
  });

  it("styles interactive dashboard chips", () => {
    const css = readFileSync(join(webRoot, "styles/msqdx-glass-persona-chip.css"), "utf8");
    expect(css).toContain(".msqdx-glass-chip.--dashboard.--interactive:hover");
    expect(css).toContain(".--trait.--interactive:hover");
  });
});
