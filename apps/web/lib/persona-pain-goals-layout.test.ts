import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("persona pain-goals layout", () => {
  it("uses stacked single-column list layout in the pain-goals card", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "components/dashboard-cards/msqdx-glass-pain-points-goals-card.tsx"
      ),
      "utf8"
    );
    expect(source).toContain('chipLayout="list"');
    expect(source).toContain("msqdx-glass-pain-goals-stack");
    expect(source).toContain("embedInSection");
  });
});
