import { describe, expect, it } from "vitest";
import { isProjectAiContextEmpty } from "./project-context";

describe("isProjectAiContextEmpty", () => {
  it("is true when both are blank or whitespace", () => {
    expect(isProjectAiContextEmpty("", "")).toBe(true);
    expect(isProjectAiContextEmpty("  ", "\n")).toBe(true);
  });

  it("is false when either side has content", () => {
    expect(isProjectAiContextEmpty("x", "")).toBe(false);
    expect(isProjectAiContextEmpty("", "y")).toBe(false);
  });

  it("considers German columns when provided", () => {
    expect(isProjectAiContextEmpty("", "", "de only", "")).toBe(false);
    expect(isProjectAiContextEmpty("", "", "", "ctx de")).toBe(false);
    expect(isProjectAiContextEmpty("", "", "", "")).toBe(true);
  });
});
