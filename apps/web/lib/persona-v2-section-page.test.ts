import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("persona v2 section page", () => {
  it("redirects legacy /bio URLs to basics", () => {
    const page = readFileSync(
      join(webRoot, "app/admin/personas-v2/[personaId]/[section]/page.tsx"),
      "utf8"
    );
    expect(page).toContain("resolvePersonaV2SectionId");
    expect(page).toContain("redirect(ADMIN_ROUTES.personaV2Section");
    expect(page).toMatch(/section !== sectionId/);
  });
});
