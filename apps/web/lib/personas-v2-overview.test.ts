import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("personas v2 overview", () => {
  it("omits preview copy and banner from library shell", () => {
    const overview = readFileSync(
      join(webRoot, "components/personas-v2/msqdx-glass-personas-v2-overview.tsx"),
      "utf8"
    );
    expect(overview).not.toContain("entitySubtitle");
    expect(overview).not.toContain("sectionDescription");
    expect(overview).not.toContain("msqdx-glass-section-v2-banner");
    expect(overview).not.toContain("previewBanner");
  });
});
