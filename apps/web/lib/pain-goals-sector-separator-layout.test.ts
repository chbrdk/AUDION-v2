import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  PAIN_GOALS_SECTOR_SEPARATOR_BORDER_RADIUS_PX,
  PAIN_GOALS_SECTOR_SEPARATOR_CORNER_STYLES,
  PAIN_GOALS_SECTOR_SEPARATOR_SURFACE,
} from "./pain-goals-sector-separator-layout";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("pain-goals sector separator layout", () => {
  it("uses cutdown corners on all four sides", () => {
    expect(PAIN_GOALS_SECTOR_SEPARATOR_CORNER_STYLES.topLeft).toBe("cutdown-b");
    expect(PAIN_GOALS_SECTOR_SEPARATOR_CORNER_STYLES.topRight).toBe("cutdown-b");
    expect(PAIN_GOALS_SECTOR_SEPARATOR_CORNER_STYLES.bottomLeft).toBe("cutdown-a");
    expect(PAIN_GOALS_SECTOR_SEPARATOR_CORNER_STYLES.bottomRight).toBe("cutdown-a");
    expect(PAIN_GOALS_SECTOR_SEPARATOR_BORDER_RADIUS_PX).toBe(24);
    expect(PAIN_GOALS_SECTOR_SEPARATOR_SURFACE).toContain("--msqdx-pain-goals-corner-surface");
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
    expect(separator).toContain("MsqdxCornerBox");
    expect(separator).toContain("msqdx-glass-pain-goals-sector-separator");
    expect(separator).toContain('role="separator"');
    expect(separator).toContain("PAIN_GOALS_SECTOR_SEPARATOR_CORNER_STYLES");
  });

  it("styles sector separator in dashboard-cards.css", () => {
    const css = readFileSync(join(webRoot, "styles/dashboard-cards.css"), "utf8");
    expect(css).toContain(".msqdx-glass-pain-goals-sector-separator");
    expect(css).toContain("--msqdx-pain-goals-sector-separator-height");
  });
});
