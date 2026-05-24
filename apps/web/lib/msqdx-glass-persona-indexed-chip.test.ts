import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("MsqdxGlassPersonaIndexedChip", () => {
  it("defines indexed pain/goal chip with corner badge and interactions", () => {
    const chip = readFileSync(
      join(webRoot, "components/msqdx/chip/msqdx-glass-persona-indexed-chip.tsx"),
      "utf8"
    );
    expect(chip).toContain("MsqdxGlassPersonaIndexedChip");
    expect(chip).toContain("MsqdxCornerBox");
    expect(chip).toContain('"--indexed"');
    expect(chip).toContain("onDoubleClick");
    expect(chip).toContain("onRequestEdit");
    expect(chip).toContain("msqdx-glass-pain-goals-slide-card__index-corner");
  });

  it("wires chip editor slider to indexed chip component", () => {
    const editor = readFileSync(
      join(webRoot, "components/generic/msqdx-glass-chip-editor.tsx"),
      "utf8"
    );
    expect(editor).toContain("MsqdxGlassPersonaIndexedChip");
    expect(editor).toContain("beginChipEdit(idx, chip)");
    expect(editor).toMatch(/useCornerTabChrome && \(chipVariant === "pain" \|\| chipVariant === "goal"\)/);
  });

  it("styles indexed chip label and hover affordance", () => {
    const css = readFileSync(join(webRoot, "styles/msqdx-glass-persona-chip.css"), "utf8");
    expect(css).toContain(".msqdx-glass-persona-indexed-chip__label");
    expect(css).toContain(".msqdx-glass-persona-indexed-chip.msqdx-glass-chip.--dashboard.--indexed.--interactive:hover");
  });
});
