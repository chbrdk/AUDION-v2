import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("msqdx-glass-admin-layout responsive nav", () => {
  it("shows hamburger until lg to match MsqdxAdminNav drawer breakpoint", () => {
    const source = readFileSync(
      join(webRoot, "components/admin/msqdx-glass-admin-layout.tsx"),
      "utf8"
    );
    expect(source).toContain('const NAV_DOCKED_BREAKPOINT = "lg"');
    expect(source).toContain('[NAV_DOCKED_BREAKPOINT]: "none"');
  });

  it("uses 1200px media query for docked nav in admin.css", () => {
    const adminCss = readFileSync(join(webRoot, "styles/admin.css"), "utf8");
    expect(adminCss).toContain("@media (min-width: 1200px)");
    expect(adminCss).not.toContain("@media (min-width: 960px)");
  });
});
