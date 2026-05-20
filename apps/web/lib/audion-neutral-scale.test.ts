import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  AUDION_NEUTRAL_LIGHT,
  AUDION_NEUTRAL_STEP_COUNT,
  AUDION_PAIN_GOALS_NEUTRAL_TOKENS,
  audionNeutralCssVar,
} from "./audion-neutral-scale";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("audion-neutral-scale", () => {
  it("exposes 20 solid steps and css var helper", () => {
    expect(AUDION_NEUTRAL_STEP_COUNT).toBe(20);
    expect(AUDION_NEUTRAL_LIGHT).toHaveLength(20);
    expect(audionNeutralCssVar(0)).toBe("--audion-neutral-00");
    expect(audionNeutralCssVar(19)).toBe("--audion-neutral-19");
  });

  it("defines solid neutral ramp and pain-goals semantic tokens in CSS (no alpha greys)", () => {
    const css = readFileSync(join(webRoot, "styles/audion-neutral-scale.css"), "utf8");
    expect(css).toContain("--audion-neutral-00: #ffffff");
    expect(css).toContain("--audion-neutral-19: #000000");
    expect(css).not.toMatch(/--audion-neutral-\d+:\s*rgba\(/);

    for (const token of AUDION_PAIN_GOALS_NEUTRAL_TOKENS) {
      expect(css).toContain(token);
    }

    const dashboard = readFileSync(join(webRoot, "styles/dashboard-cards.css"), "utf8");
    expect(dashboard).toContain("--msqdx-pain-goals-corner-surface");
    expect(dashboard).toContain("--msqdx-pain-goals-slide-surface");
    expect(dashboard).not.toContain("rgba(148, 163, 184");
    expect(dashboard).toMatch(/\.msqdx-glass-pain-goals-slide-card\s*\{[^}]*border:\s*none/);
    expect(css).toContain("--msqdx-pain-goals-corner-surface: var(--audion-neutral-01)");
    expect(css).toContain("--msqdx-pain-goals-slide-surface: var(--audion-neutral-01)");
    expect(css).toContain("--msqdx-pain-goals-slide-surface-pain: var(--msqdx-pain-goals-slide-surface)");
    expect(dashboard).toContain("msqdx-glass-pain-goals-slide-card__index-corner");
  });
});
