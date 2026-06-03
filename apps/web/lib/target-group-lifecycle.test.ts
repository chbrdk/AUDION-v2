import { describe, expect, it } from "vitest";

import {
  TARGET_GROUP_LIFECYCLE,
  coerceTargetGroupStatus,
  isLegacyActiveTargetGroupStatus,
  isTargetGroupArchived,
} from "./target-group-lifecycle";

describe("target group lifecycle", () => {
  it("coerces legacy draft/published to active", () => {
    expect(coerceTargetGroupStatus(undefined)).toBe(TARGET_GROUP_LIFECYCLE.active);
    expect(coerceTargetGroupStatus("draft")).toBe(TARGET_GROUP_LIFECYCLE.active);
    expect(coerceTargetGroupStatus("published")).toBe(TARGET_GROUP_LIFECYCLE.active);
    expect(coerceTargetGroupStatus("active")).toBe(TARGET_GROUP_LIFECYCLE.active);
  });

  it("recognizes archived status", () => {
    expect(coerceTargetGroupStatus("archived")).toBe(TARGET_GROUP_LIFECYCLE.archived);
    expect(isTargetGroupArchived("archived")).toBe(true);
    expect(isTargetGroupArchived("published")).toBe(false);
  });

  it("flags legacy active values", () => {
    expect(isLegacyActiveTargetGroupStatus("draft")).toBe(true);
    expect(isLegacyActiveTargetGroupStatus("archived")).toBe(false);
  });
});
