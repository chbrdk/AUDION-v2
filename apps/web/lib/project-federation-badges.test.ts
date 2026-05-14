import { describe, expect, it } from "vitest";

import { projectFederationChipKinds } from "./project-federation-badges";

describe("projectFederationChipKinds", () => {
  it("returns local when no platform id and no checkion id", () => {
    expect(projectFederationChipKinds({})).toEqual(["local"]);
    expect(projectFederationChipKinds({ platform_project_id: null, checkion_project_id: null })).toEqual(["local"]);
    expect(projectFederationChipKinds({ platform_project_id: "  ", checkion_project_id: "" })).toEqual(["local"]);
  });

  it("returns plexon when only platform company id is set (central context)", () => {
    expect(projectFederationChipKinds({ platform_company_id: "co-1" })).toEqual(["plexon"]);
  });

  it("returns plexon only when only platform project is set", () => {
    expect(projectFederationChipKinds({ platform_project_id: "pp-1" })).toEqual(["plexon"]);
  });

  it("returns checkion only when only checkion is set (legacy link)", () => {
    expect(projectFederationChipKinds({ checkion_project_id: "cp-1" })).toEqual(["checkion"]);
  });

  it("returns both when linked to PLEXON and CHECKION", () => {
    expect(
      projectFederationChipKinds({
        platform_project_id: "pp-1",
        checkion_project_id: "cp-1",
      })
    ).toEqual(["plexon", "checkion"]);
  });
});
