import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("useAdminHeaderV2Context", () => {
  it("wires three compact pickers in the header card", () => {
    const pickers = readFileSync(
      join(webRoot, "components/admin/msqdx-glass-admin-header-context-pickers.tsx"),
      "utf8"
    );
    const card = readFileSync(
      join(webRoot, "components/admin/msqdx-glass-admin-header-v2-card.tsx"),
      "utf8"
    );
    expect(card).toContain("MsqdxGlassAdminHeaderContextPickers");
    expect(pickers).toContain("MsqdxGlassAdminHeaderCompactPicker");
    expect(pickers).toContain('t("personaAdmin.targetGroup")');
    expect(pickers).toContain('t("nav.personas")');
    expect(pickers).toContain("ADMIN_HEADER_V2_CARD_PICKER_DIVIDER_CLASS");
  });

  it("loads target groups and personas from admin APIs", () => {
    const hook = readFileSync(join(webRoot, "lib/use-admin-header-v2-context.ts"), "utf8");
    expect(hook).toContain(".listTargetGroups");
    expect(hook).toContain("fetchTargetGroupPersonas");
    expect(hook).toContain("ADMIN_ROUTES.personaV2Section");
  });

  it("styles picker row and dividers in admin-header-v2.css", () => {
    const css = readFileSync(join(webRoot, "styles/admin-header-v2.css"), "utf8");
    expect(css).toContain(".msqdx-glass-admin-header-card__pickers");
    expect(css).toContain(".msqdx-glass-admin-header-card__picker-divider");
    expect(css).toContain(".msqdx-glass-admin-header-compact-picker");
  });
});
