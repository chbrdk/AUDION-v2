import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("section entity header corner accent", () => {
  it("renders MsqdxCornerBox when entityCornerAccent is enabled", () => {
    const entity = readFileSync(
      join(webRoot, "components/admin/section-shell/msqdx-glass-section-entity-header.tsx"),
      "utf8"
    );
    expect(entity).toContain("MsqdxCornerBox");
    expect(entity).toContain("entityCornerAccent");
    expect(entity).toContain("msqdx-glass-section-shell__entity-hero");
    expect(entity).toContain("entity-main--on-accent");
    expect(entity).toContain("msqdx-glass-section-shell__entity--has-corner-accent");
    expect(entity).toContain("SECTION_WORKSPACE_DOCK_BORDER_RADIUS_PX");
    expect(entity).toContain("msqdx-entity-accent-on-surface");
    expect(entity).toContain("topLeft=\"rounded\"");
    expect(entity).toContain("topRight=\"cutdown-a\"");
    expect(entity).toContain("bottomLeft=\"cutdown-b\"");
    expect(entity).toContain("bottomRight=\"rounded\"");
    expect(entity).toContain("textAlign: \"right\"");

    const shell = readFileSync(
      join(webRoot, "components/admin/section-shell/msqdx-glass-section-shell.tsx"),
      "utf8"
    );
    expect(shell).toContain("entityCornerAccent");

    const types = readFileSync(
      join(webRoot, "components/admin/section-shell/section-shell-types.ts"),
      "utf8"
    );
    expect(types).toContain("entityCornerAccent");

    const css = readFileSync(join(webRoot, "styles/section-shell.css"), "utf8");
    expect(css).toContain(".msqdx-glass-section-shell__entity--has-corner-accent");
    expect(css).toContain(".msqdx-glass-section-shell__entity-hero");
    expect(css).toContain(".msqdx-glass-section-shell__entity-main--on-accent");
    expect(css).toContain("--msqdx-entity-accent-on-surface");
    expect(css).toContain(
      ".msqdx-glass-section-shell__entity-corner-accent .msqdx-glass-section-shell__entity-main--on-accent h1.msqdx-glass-section-shell__title"
    );
    expect(css).toContain("!important");
    expect(css).toContain("text-align: right");
    expect(css).not.toContain("calc(72px + var(--msqdx-spacing-md))");
  });
});
