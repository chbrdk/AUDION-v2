import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("msqdx-glass-admin-layout responsive nav", () => {
  it("shows hamburger until md to match MsqdxAdminNav drawer breakpoint", () => {
    const source = readFileSync(
      join(webRoot, "components/admin/msqdx-glass-admin-layout.tsx"),
      "utf8"
    );
    expect(source).toContain('const NAV_DOCKED_BREAKPOINT = "md"');
    expect(source).toContain('[NAV_DOCKED_BREAKPOINT]: "none"');
  });

  it("keeps personas v2 header card visible below md with mobile context drawer", () => {
    const layout = readFileSync(
      join(webRoot, "components/admin/msqdx-glass-admin-layout.tsx"),
      "utf8"
    );
    const v2HeaderBranch =
      layout.match(/isPersonasV2Chrome\s*\?\s*\([\s\S]*?\)\s*:\s*\(/)?.[0] ?? "";
    expect(v2HeaderBranch).toContain('display: "flex"');
    expect(v2HeaderBranch).not.toContain('xs: "none"');
    expect(v2HeaderBranch).toContain("MsqdxGlassAdminHeaderV2Card");
  });

  it("uses 900px media query for docked nav in admin.css", () => {
    const adminCss = readFileSync(join(webRoot, "styles/admin.css"), "utf8");
    expect(adminCss).toContain("@media (min-width: 900px)");
    expect(adminCss).not.toContain("@media (min-width: 1200px)");
  });

  it("restores app frame and sidebar chrome borders", () => {
    const layout = readFileSync(
      join(webRoot, "components/admin/msqdx-glass-admin-layout.tsx"),
      "utf8"
    );
    expect(layout).toContain('borderWidth="thick"');
    expect(layout).toContain("chromeBorderOnDark");
    expect(layout).toContain("borderRightColor: chromeBorderOnLight");
  });
});
