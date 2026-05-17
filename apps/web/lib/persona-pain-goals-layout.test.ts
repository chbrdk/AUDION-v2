import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("persona pain-goals layout", () => {
  it("uses horizontal slider layout (3.5 visible) in the pain-goals card", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "components/dashboard-cards/msqdx-glass-pain-points-goals-card.tsx"
      ),
      "utf8"
    );
    expect(source).toContain('chipLayout="slider"');
    expect(source).toContain("slidesVisible={3.5}");
    expect(source).toContain("msqdx-glass-pain-goals-stack");
    expect(source).toContain("embedInSection");
  });
});
