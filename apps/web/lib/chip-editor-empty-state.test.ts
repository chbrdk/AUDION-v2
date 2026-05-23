import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("chip editor entry actions", () => {
  it("renders Add inside corner-tab card for empty and filled states", () => {
    const source = readFileSync(
      join(webRoot, "components/generic/msqdx-glass-chip-editor.tsx"),
      "utf8"
    );
    expect(source).toContain("msqdx-glass-chip-editor__card-entry-actions");
    expect(source).toMatch(/useCornerTabShell \? entryActionsContent : null/);
    expect(source).toMatch(
      /useCornerTabShell && entryActionsContent[\s\S]*?entryActionsContent/
    );
    expect(source).toMatch(/!useCornerTabShell && entryActionsContent/);
  });

  it("always exposes corner-tab icon buttons for add, edit, and ai", () => {
    const source = readFileSync(
      join(webRoot, "components/generic/msqdx-glass-chip-editor.tsx"),
      "utf8"
    );
    expect(source).toContain("cornerTabActionButtonNodes");
    expect(source).toContain("MsqdxGlassAddButtonIcon");
    expect(source).toMatch(/hasChips[\s\S]*MsqdxGlassEditButton[\s\S]*canAddMore[\s\S]*MsqdxGlassAddButtonIcon/);
  });
});
