import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("persona v2 detail admin header", () => {
  it("registers back link in header start slot and hides duplicate on md+", () => {
    const layout = readFileSync(
      join(webRoot, "components/personas-v2/msqdx-glass-persona-v2-detail-layout.tsx"),
      "utf8"
    );
    expect(layout).toContain("setHeaderStartContent");
    expect(layout).toContain("msqdx-glass-persona-v2-detail");
    expect(layout).toContain("ADMIN_ROUTES.personasV2");

    const providers = readFileSync(
      join(webRoot, "components/admin/admin-layout-providers.tsx"),
      "utf8"
    );
    expect(providers).toContain("headerStartContent");
    expect(providers).toContain("setHeaderStartContent");

    const css = readFileSync(join(webRoot, "styles/section-shell.css"), "utf8");
    expect(css).toMatch(
      /\.msqdx-glass-persona-v2-detail\s+\.msqdx-glass-section-shell__entity-back/
    );
  });
});
