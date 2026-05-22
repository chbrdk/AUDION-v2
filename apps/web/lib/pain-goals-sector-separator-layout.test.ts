import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  PAIN_GOALS_SECTOR_SEPARATOR_BLEED_PADDING,
  PAIN_GOALS_SECTOR_SEPARATOR_BORDER_RADIUS_PX,
  PAIN_GOALS_SECTOR_SEPARATOR_COLOR,
  PAIN_GOALS_SECTOR_SEPARATOR_CORNER_STYLES,
  PAIN_GOALS_SECTOR_SEPARATOR_HEIGHT_PX,
  PAIN_GOALS_SECTOR_SEPARATOR_LINE_HEIGHT_PX,
} from "./pain-goals-sector-separator-layout";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("pain-goals sector separator layout", () => {
  it("uses workspace frame border color and 7px separator line", () => {
    expect(PAIN_GOALS_SECTOR_SEPARATOR_HEIGHT_PX).toBe(7);
    expect(PAIN_GOALS_SECTOR_SEPARATOR_LINE_HEIGHT_PX).toBe(7);
    expect(PAIN_GOALS_SECTOR_SEPARATOR_COLOR).toContain("--msqdx-section-workspace-frame-border");
    expect(PAIN_GOALS_SECTOR_SEPARATOR_CORNER_STYLES.topLeft.topLeft).toBe("cutdown-b");
    expect(PAIN_GOALS_SECTOR_SEPARATOR_CORNER_STYLES.bottomLeft.bottomLeft).toBe("cutdown-b");
    expect(PAIN_GOALS_SECTOR_SEPARATOR_CORNER_STYLES.bottomRight.bottomRight).toBe("cutdown-b");
    expect(PAIN_GOALS_SECTOR_SEPARATOR_BORDER_RADIUS_PX).toBe(24);
    expect(PAIN_GOALS_SECTOR_SEPARATOR_BLEED_PADDING).toContain("--msqdx-spacing-lg");
  });

  it("renders separator between pain and goal blocks", () => {
    const card = readFileSync(
      join(webRoot, "components/dashboard-cards/msqdx-glass-pain-points-goals-card.tsx"),
      "utf8"
    );
    const separator = readFileSync(
      join(webRoot, "components/generic/msqdx-glass-pain-goals-sector-separator.tsx"),
      "utf8"
    );
    expect(card).toContain("MsqdxGlassPainGoalsSectorSeparator");
    expect(card).toMatch(
      /--pain[\s\S]*MsqdxGlassPainGoalsSectorSeparator[\s\S]*--goal/
    );
    expect(separator).not.toContain("MsqdxCornerBox");
    expect(separator).toContain("PAIN_GOALS_SECTOR_SEPARATOR_CORNER_KEYS");
    expect(separator).toContain("msqdx-glass-pain-goals-sector-separator__corner--${corner}");
    expect(separator).toContain("msqdx-glass-pain-goals-sector-separator__line");
    expect(separator).toContain('role="separator"');
    expect(separator).not.toContain("bgcolor:");
    expect(separator).not.toContain("PAIN_GOALS_SECTOR_SEPARATOR_COLOR");
  });

  it("styles sector separator in dashboard-cards.css", () => {
    const css = readFileSync(join(webRoot, "styles/dashboard-cards.css"), "utf8");
    expect(css).toContain(".msqdx-glass-pain-goals-sector-separator");
    expect(css).toContain(".msqdx-glass-pain-goals-sector-separator__line");
    expect(css).toContain("--msqdx-pain-goals-sector-separator-line");
    expect(css).toContain("--msqdx-pain-goals-sector-separator-height: 7px");
    expect(css).toContain("--msqdx-pain-goals-sector-separator-line-height: var(--msqdx-pain-goals-sector-separator-height)");
    expect(css).toMatch(/\.msqdx-glass-pain-goals-sector-separator[^}]*border:\s*none/);
    expect(css).toMatch(/\.msqdx-glass-pain-goals-sector-separator__line[^}]*border:\s*none/);
    expect(css).toContain(".msqdx-glass-pain-goals-sector-separator__corner--bottom-right::before");
    expect(css).toMatch(
      /\.msqdx-glass-pain-goals-sector-separator__corner--bottom-right::before[^}]*mask-image:\s*radial-gradient/
    );
    expect(css).toContain(".msqdx-glass-pain-goals-sector-separator__corner--top-left::before");
    expect(css).toContain(".msqdx-glass-pain-goals-sector-separator__corner--bottom-left::before");
    expect(css).toContain("--msqdx-section-workspace-frame-border");
    expect(css).toMatch(
      /\.msqdx-glass-pain-goals-section\s*>\s*\.msqdx-glass-pain-goals-stack\s*>\s*\.msqdx-glass-pain-goals-sector-separator/
    );
    expect(css).toContain(".msqdx-glass-persona-basics-stack > .msqdx-glass-pain-goals-sector-separator");
    expect(css).toMatch(
      /margin-inline:\s*calc\(-1 \* var\(--msqdx-section-workspace-dock-padding/
    );
  });
});
