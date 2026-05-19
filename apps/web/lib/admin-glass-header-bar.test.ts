import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("admin glass header bar chrome", () => {
  it("defines frosted background tokens for light and dark on --color-neutral", () => {
    const globals = readFileSync(join(webRoot, "styles/globals.css"), "utf8");
    expect(globals).toContain("--msqdx-glass-admin-header-bar-bg:");
    expect(globals).toContain("rgb(from var(--color-neutral) r g b / 0.3)");
    expect(globals).toContain("rgb(from var(--color-neutral) r g b / 0.82)");
  });

  it("header Box uses the CSS variable and no divider border", () => {
    const layout = readFileSync(join(webRoot, "components/admin/msqdx-glass-admin-layout.tsx"), "utf8");
    expect(layout).toContain("backgroundColor: \"var(--msqdx-glass-admin-header-bar-bg)\"");
    expect(layout).toContain("borderBottom: \"none\"");
    expect(layout).not.toMatch(/borderBottom:\s*\(/);
    expect(layout).toContain("headerStartContent");
    expect(layout).toContain("<AdminTopControls />");
  });

  it("applies a bottom fade mask on the admin header only", () => {
    const layout = readFileSync(join(webRoot, "components/admin/msqdx-glass-admin-layout.tsx"), "utf8");
    const adminCss = readFileSync(join(webRoot, "styles/admin.css"), "utf8");
    expect(layout).toContain("msqdx-glass-admin-header-bar--fade-bottom");
    expect(layout).toContain("msqdx-glass-admin-header-bar-mask");
    expect(adminCss).toContain(".msqdx-glass-admin-header-bar-mask");
    expect(adminCss).toContain(".msqdx-glass-admin-header-bar--fade-bottom");
    expect(adminCss).toContain("mask-image:");
    expect(adminCss).toContain("--msqdx-glass-admin-header-bar-mask-fade-depth");
  });

  it("gives main content enough top padding to clear the absolute header", () => {
    const layout = readFileSync(join(webRoot, "components/admin/msqdx-glass-admin-layout.tsx"), "utf8");
    expect(layout).toContain("paddingTop: \"100px !important\"");
  });

  it("applies the same top padding in share-chat main across all viewports", () => {
    const shareLayout = readFileSync(join(webRoot, "components/chat/chat-share-layout.tsx"), "utf8");
    expect(shareLayout).toContain("paddingTop: \"100px !important\"");
  });
});
