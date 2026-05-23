import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ADMIN_CONTENT_PADDING_TOP_V2 } from "./admin-header-layout";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("persona v2 admin scroll containment", () => {
  it("hides main scrollbar on personas-v2 routes", () => {
    const layout = readFileSync(
      join(webRoot, "components/admin/msqdx-glass-admin-layout.tsx"),
      "utf8"
    );
    expect(layout).toContain('overflowY: isPersonasV2Chrome ? "hidden" : "auto"');
    expect(layout).toContain("ADMIN_CONTENT_PADDING_TOP_V2");
  });

  it("scrolls inside workspace dock shell instead of main", () => {
    const css = readFileSync(join(webRoot, "styles/persona-v2-section-panel.css"), "utf8");
    expect(css).toMatch(
      /\.msqdx-glass-persona-v2-detail \.msqdx-glass-section-workspace__dock-shell[^}]*overflow-y:\s*auto/
    );
    expect(css).toMatch(/\.msqdx-glass-persona-v2-detail[^}]*overflow:\s*hidden/);
  });

  it("does not scroll inside nav column on desktop", () => {
    const css = readFileSync(join(webRoot, "styles/persona-v2-section-panel.css"), "utf8");
    expect(css).toMatch(
      /\.msqdx-glass-persona-v2-detail \.msqdx-glass-section-shell__nav-column[^}]*overflow:\s*hidden/
    );
    expect(css).not.toMatch(
      /\.msqdx-glass-persona-v2-detail \.msqdx-glass-section-shell__nav-column[^}]*overflow-y:\s*auto/
    );
  });

  it("defines compact v2 main padding top", () => {
    expect(ADMIN_CONTENT_PADDING_TOP_V2).toContain("calc(");
    expect(ADMIN_CONTENT_PADDING_TOP_V2).toContain("55px");
  });
});
