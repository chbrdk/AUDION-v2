import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("persona v2 communication flat section", () => {
  it("uses flat communication stack when embedInSection", () => {
    const card = readFileSync(
      join(webRoot, "components/dashboard-cards/msqdx-glass-communication-card.tsx"),
      "utf8"
    );
    expect(card).toContain("embedInSection");
    expect(card).toContain("msqdx-glass-communication-stack");
    expect(card).toContain("MsqdxGlassPainGoalsSectorSeparator");
    expect(card).toContain("COMMUNICATION_VOCABULARY_CHIP_PROPS");
    expect(card).toContain('chipClassName="--vocab"');
    expect(card).toMatch(/if \(embedInSection\)[\s\S]*msqdx-glass-communication-section/);
    expect(card).toContain("PersonaV2SectionBlock");
  });

  it("passes embedInSection from persona admin panel", () => {
    const panel = readFileSync(
      join(webRoot, "components/msqdx-glass-persona-admin-panel.tsx"),
      "utf8"
    );
    expect(panel).toMatch(
      /MsqdxGlassCommunicationCard[\s\S]*embedInSection=\{isV2Section\}/
    );
  });

  it("styles communication section like personality", () => {
    const css = readFileSync(join(webRoot, "styles/dashboard-cards.css"), "utf8");
    expect(css).toContain(".msqdx-glass-communication-section");
    expect(css).toContain(".msqdx-glass-communication-section .msqdx-glass-chip-editor__corner-tab-shell");
    expect(css).toContain(".msqdx-glass-communication-section .msqdx-glass-chip-editor--corner-tab");
    expect(css).toContain(".msqdx-glass-communication-stack__block.--vocab");
    expect(css).toMatch(
      /\.msqdx-glass-communication-stack__block\.--vocab \.msqdx-glass-chip-editor__chips--grid[^}]*grid-template-columns:\s*repeat\(2/
    );
  });
});
