import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("chip editor empty state actions", () => {
  it("renders Add inside corner-tab card body when shell is active", () => {
    const source = readFileSync(
      join(webRoot, "components/generic/msqdx-glass-chip-editor.tsx"),
      "utf8"
    );
    expect(source).toContain("msqdx-glass-chip-editor__empty-state");
    expect(source).toMatch(/useCornerTabShell \? emptyStateActions : null/);
    expect(source).toMatch(
      /showEmptyState && !showEmptyEntryInGrid && !useCornerTabShell && emptyStateActions/
    );
  });
});
