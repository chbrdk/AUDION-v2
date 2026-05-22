import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("persona basics hero v2", () => {
  it("uses icon buttons for archive and delete without chat prompt action", () => {
    const hero = readFileSync(
      join(webRoot, "components/personas-v2/msqdx-glass-persona-basics-hero.tsx"),
      "utf8"
    );
    expect(hero).toContain("msqdx-glass-persona-basics-hero__icon-action");
    expect(hero).toContain("IconButton");
    expect(hero).not.toContain("ensureChatPrompt");
    expect(hero).not.toContain("onEnsureChatPrompt");
  });

  it("does not pass ensure chat prompt props from v2 panel", () => {
    const panel = readFileSync(
      join(webRoot, "components/msqdx-glass-persona-admin-panel.tsx"),
      "utf8"
    );
    expect(panel).toMatch(
      /MsqdxGlassPersonaBasicsHero[\s\S]*onEnrichWithAi=\{handleEnrichWithAi\}/
    );
    expect(panel).not.toMatch(
      /MsqdxGlassPersonaBasicsHero[\s\S]*onEnsureChatPrompt/
    );
  });
});
