import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isPersonasV2AdminPath } from "./admin-header-layout";

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
    expect(layout).toContain("MsqdxGlassAdminHeaderPageTitle");
    expect(layout).toContain("ADMIN_HEADER_V2_BAR_CLASS");
  });

  it("defines bordered card and compact project picker styles", () => {
    const css = readFileSync(join(webRoot, "styles/admin-header-v2.css"), "utf8");
    expect(css).toContain(".msqdx-glass-admin-header-card");
    expect(css).toContain("border-radius: var(--msqdx-radius-3xl");
    expect(css).toContain("margin-left: var(--msqdx-admin-header-logo-inset");
    expect(css).toContain(".msqdx-glass-admin-project-picker");
    expect(css).toMatch(/mask-image:\s*none/);
  });

  it("uses header card project picker instead of legacy MsqdxSelect form", () => {
    const picker = readFileSync(
      join(webRoot, "components/admin/msqdx-glass-admin-project-picker.tsx"),
      "utf8"
    );
    expect(picker).toContain("msqdx-glass-admin-project-picker__label");
    expect(picker).not.toContain("MsqdxSelect");
  });
});
