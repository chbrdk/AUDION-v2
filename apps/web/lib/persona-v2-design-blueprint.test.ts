import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const knowledgeRoot = join(webRoot, "..", "..", "knowledge");

describe("persona v2 design blueprint", () => {
  it("documents canonical shell, section contract, and TG v2 checklist", () => {
    const doc = readFileSync(join(knowledgeRoot, "persona-v2-design-blueprint.md"), "utf8");
    expect(doc).toContain("MsqdxGlassSectionShell");
    expect(doc).toContain("embedInSection");
    expect(doc).toContain("PersonaV2SectionBlock");
    expect(doc).toContain("target groups v2");
    expect(doc).toMatch(/\| knowledge \| ❌/);
  });
});
