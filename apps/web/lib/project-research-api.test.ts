import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { API_ROUTES } from "./api-routes";

describe("project research API routes", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ run_id: "r1", status: "queued" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockClear();
  });

  it("builds start/status/latest routes", () => {
    expect(API_ROUTES.projectResearchStart("p1")).toContain("/api/projects/p1/research/start");
    expect(API_ROUTES.projectResearchLatest("p1")).toContain("/api/projects/p1/research/latest");
    expect(API_ROUTES.projectResearchStatus("p1", "r1")).toContain("run_id=r1");
    expect(API_ROUTES.projectResearchStream("p1", "r1")).toContain("/api/projects/p1/research/stream?run_id=r1");
    expect(API_ROUTES.projectResearchStream("p1", "r1", "e1")).toContain("after=e1");
  });
});

