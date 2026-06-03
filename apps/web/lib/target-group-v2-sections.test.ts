import { describe, expect, it } from "vitest";
import {
  TARGET_GROUP_V2_DEFAULT_SECTION,
  TARGET_GROUP_V2_SECTION_IDS,
  TARGET_GROUP_V2_SECTIONS,
  isTargetGroupV2SectionId,
  resolveTargetGroupV2SectionId,
  targetGroupV2SectionHref,
} from "./target-group-v2-sections";
import { isTargetGroupV2SectionContentVisible } from "./target-group-v2-section-visibility";
import { ADMIN_ROUTES } from "./routes";

describe("target-group-v2-sections", () => {
  it("has unique section ids", () => {
    const ids = TARGET_GROUP_V2_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("matches exported id list", () => {
    expect(TARGET_GROUP_V2_SECTION_IDS).toEqual(TARGET_GROUP_V2_SECTIONS.map((s) => s.id));
  });

  it("defaults to basics", () => {
    expect(TARGET_GROUP_V2_DEFAULT_SECTION).toBe("basics");
  });

  it("builds section hrefs", () => {
    expect(targetGroupV2SectionHref("tg-1", "personas")).toBe(
      "/admin/target-groups-v2/tg-1/personas"
    );
  });

  it("validates section ids", () => {
    expect(isTargetGroupV2SectionId("sources")).toBe(true);
    expect(isTargetGroupV2SectionId("unknown")).toBe(false);
  });

  it("maps legacy knowledge/documents routes to sources", () => {
    expect(resolveTargetGroupV2SectionId("knowledge")).toBe("sources");
    expect(resolveTargetGroupV2SectionId("documents")).toBe("sources");
    expect(resolveTargetGroupV2SectionId("sources")).toBe("sources");
  });
});

describe("target-group-v2-section-visibility", () => {
  it("shows all blocks in v1 mode", () => {
    expect(isTargetGroupV2SectionContentVisible(undefined, "v1", "sources")).toBe(true);
  });

  it("gates blocks in v2-section mode", () => {
    expect(isTargetGroupV2SectionContentVisible("personas", "v2-section", "personas")).toBe(true);
    expect(isTargetGroupV2SectionContentVisible("personas", "v2-section", "sources")).toBe(false);
  });
});

describe("target groups v2 routes", () => {
  it("exports v2 route helpers", () => {
    expect(ADMIN_ROUTES.targetGroupsV2).toBe("/admin/target-groups-v2");
    expect(ADMIN_ROUTES.targetGroupV2Section("x", "basics")).toBe(
      "/admin/target-groups-v2/x/basics"
    );
  });
});
