import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PERSONA_BASICS_HERO_AVATAR_SIZE_PX } from "./persona-basics-hero-layout";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("persona basics hero layout", () => {
  it("uses a larger avatar size token", () => {
    expect(PERSONA_BASICS_HERO_AVATAR_SIZE_PX).toBe(120);
    const css = readFileSync(join(webRoot, "styles/persona-v2-section-panel.css"), "utf8");
    expect(css).toContain(".msqdx-glass-persona-basics-hero");
    expect(css).toContain(`${PERSONA_BASICS_HERO_AVATAR_SIZE_PX}px`);
  });
});
