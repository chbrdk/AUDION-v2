import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("alwaysEditMode field editor", () => {
  it("exposes alwaysEditMode on field and entity editors", () => {
    const fieldEditor = readFileSync(
      join(webRoot, "components/generic/msqdx-glass-field-editor.tsx"),
      "utf8"
    );
    const entityEditor = readFileSync(
      join(webRoot, "components/generic/msqdx-glass-entity-editor.tsx"),
      "utf8"
    );
    expect(fieldEditor).toContain("alwaysEditMode");
    expect(fieldEditor).toContain("MsqdxGlassInlineEditControls");
    expect(entityEditor).toContain("alwaysEditMode");
  });

  it("enables alwaysEditMode for target group v2 basics", () => {
    const panel = readFileSync(
      join(webRoot, "components/msqdx-glass-target-group-admin-panel.tsx"),
      "utf8"
    );
    expect(panel).toContain("alwaysEditMode={isV2Section}");
    expect(panel).toContain("bilingualColumns={isV2Section}");
  });

  it("pairs bilingual rows in entity editor", () => {
    const entityEditor = readFileSync(
      join(webRoot, "components/generic/msqdx-glass-entity-editor.tsx"),
      "utf8"
    );
    expect(entityEditor).toContain("buildBilingualFieldRows");
    expect(entityEditor).toContain("msqdx-glass-entity-editor__bilingual-grid");
    expect(entityEditor).toContain("msqdx-glass-entity-editor__bilingual-cell-locale");
    expect(entityEditor).toContain('display: { xs: "block", sm: "none" }');
  });
});
