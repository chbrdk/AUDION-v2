import { describe, expect, it } from "vitest";

import { resolvePreferredProjectId } from "./project-selection";

describe("AUDION project selection", () => {
  it("prefers a valid launch-context project over stored selections", () => {
    expect(
      resolvePreferredProjectId(["project-1", "project-2"], {
        launchProjectId: "project-2",
        activeProjectId: "project-1",
        cookieProjectId: "project-1",
        defaultProjectId: "project-1",
      })
    ).toBe("project-2");
  });

  it("falls back to the backend default when no explicit launch selection exists", () => {
    expect(
      resolvePreferredProjectId(["project-1", "project-2"], {
        launchProjectId: "missing-project",
        activeProjectId: null,
        cookieProjectId: null,
        defaultProjectId: "project-1",
      })
    ).toBe("project-1");
  });
});
