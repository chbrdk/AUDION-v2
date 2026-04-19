import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { suggestProjectTargetGroups } from "./projects-suggest-target-groups";

describe("suggestProjectTargetGroups", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ suggestions: [{ name: "A", segment: "a", description: "d" }] }), {
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

  it("sends bilingual flag when requested", async () => {
    await suggestProjectTargetGroups("proj-1", { bilingual: true, maxSuggestions: 4 });
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.bilingual).toBe(true);
    expect(body.max_suggestions).toBe(4);
  });

  it("omits bilingual when false", async () => {
    await suggestProjectTargetGroups("proj-1", { maxSuggestions: 5 });
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.bilingual).toBeUndefined();
  });
});
