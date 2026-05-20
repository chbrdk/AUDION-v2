import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ADMIN_HEADER_V2_BACK_BUTTON_SIZE_PX,
  ADMIN_HEADER_V2_CARD_ACTION_SIZE_PX,
  isPersonasV2AdminPath,
} from "./admin-header-layout";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("admin header v2 card", () => {
  it("detects personas v2 admin routes", () => {
    expect(isPersonasV2AdminPath("/admin/personas-v2")).toBe(true);
    expect(isPersonasV2AdminPath("/admin/personas-v2/abc/basics")).toBe(true);
    expect(isPersonasV2AdminPath("/admin/personas")).toBe(false);
    expect(isPersonasV2AdminPath(null)).toBe(false);
  });

  it("renders rounded header card on personas v2 chrome", () => {
    const layout = readFileSync(
      join(webRoot, "components/admin/msqdx-glass-admin-layout.tsx"),
      "utf8"
    );
    expect(layout).toContain("isPersonasV2AdminPath");
    expect(layout).toContain("MsqdxGlassAdminHeaderV2Card");
    expect(layout).toContain("ADMIN_HEADER_V2_ROW_CLASS");
    expect(layout).toContain("ADMIN_HEADER_V2_BACK_SLOT_CLASS");
    expect(layout).not.toContain("startAfterProject");
    expect(layout).toContain("MsqdxGlassAdminHeaderPageTitle");
    const pageTitle = readFileSync(
      join(webRoot, "components/admin/msqdx-glass-admin-header-page-title.tsx"),
      "utf8"
    );
    expect(pageTitle).toContain("MsqdxGlassAdminHeaderChatIconButton");
    expect(pageTitle).toMatch(/variant === "card"[\s\S]*cardChatButton/);
    const cardTitleReturn =
      pageTitle.match(/if \(variant === "card"\) \{[\s\S]*?\n  \}/)?.[0] ?? "";
    expect(cardTitleReturn).toContain("{cardChatButton}");
    expect(cardTitleReturn).not.toContain("MsqdxButton");
    expect(layout).toContain("ADMIN_HEADER_V2_BAR_CLASS");
    const card = readFileSync(
      join(webRoot, "components/admin/msqdx-glass-admin-header-v2-card.tsx"),
      "utf8"
    );
    expect(card).toContain("MsqdxGlassAdminHeaderContextPickers");
  });

  it("defines bordered card and compact project picker styles", () => {
    const css = readFileSync(join(webRoot, "styles/admin-header-v2.css"), "utf8");
    expect(css).toContain(".msqdx-glass-admin-header-card");
    expect(css).toContain("border-radius: var(--msqdx-radius-3xl");
    expect(css).toContain(".msqdx-glass-admin-header-v2-row");
    expect(css).toContain(".msqdx-glass-admin-header-v2-back");
    expect(css).toContain(".msqdx-glass-admin-header-v2-back-button__btn");
    expect(css).toContain("--msqdx-admin-header-v2-chrome-block-height");
    expect(css).toContain("--msqdx-admin-header-v2-back-button-size");
    expect(css).toMatch(
      /\.msqdx-glass-admin-header-v2-back[^}]*height:\s*var\(--msqdx-admin-header-v2-chrome-block-height\)/
    );
    expect(ADMIN_HEADER_V2_BACK_BUTTON_SIZE_PX).toBe(55);
    const globals = readFileSync(join(webRoot, "styles/globals.css"), "utf8");
    expect(globals).toContain("--msqdx-admin-header-v2-back-button-size: 55px");
    expect(globals).toContain("--msqdx-admin-header-v2-card-action-size: 40px");
    expect(css).toContain(".msqdx-glass-admin-header-v2-chat-button__btn");
    expect(ADMIN_HEADER_V2_CARD_ACTION_SIZE_PX).toBe(40);
    expect(css).toMatch(/\.msqdx-glass-admin-header-v2-row[^}]*margin-left:\s*var\(--msqdx-admin-header-logo-inset/);
    expect(css).toContain(".msqdx-glass-admin-header-compact-picker");
    expect(css).toContain(".msqdx-glass-admin-header-card__pickers");
    expect(css).toMatch(/mask-image:\s*none/);
    expect(css).toMatch(/\.msqdx-glass-admin-header-bar--v2-card[^}]*border-bottom:\s*none/);
  });

  it("does not apply monochrome legacy header bottom border on v2 card", () => {
    const mono = readFileSync(join(webRoot, "styles/monochrome-theme.css"), "utf8");
    expect(mono).toContain(
      ".msqdx-glass-admin-header-bar:not(.msqdx-glass-admin-header-bar--v2-card)"
    );
  });

  it("uses compact pickers instead of legacy MsqdxSelect in v2 header", () => {
    const pickers = readFileSync(
      join(webRoot, "components/admin/msqdx-glass-admin-header-context-pickers.tsx"),
      "utf8"
    );
    expect(pickers).toContain("MsqdxGlassAdminHeaderCompactPicker");
    expect(pickers).not.toContain("MsqdxSelect");
  });
});
