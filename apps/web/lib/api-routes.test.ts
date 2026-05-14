import { describe, expect, it } from "vitest";

import { API_ROUTES } from "./api-routes";

describe("API_ROUTES.projectPlexonMirror", () => {
  it("encodes project id in path", () => {
    expect(API_ROUTES.projectPlexonMirror("abc-123")).toBe("/api/projects/abc-123/plexon-mirror");
    expect(API_ROUTES.projectPlexonMirror("x/y")).toBe("/api/projects/x%2Fy/plexon-mirror");
  });
});
