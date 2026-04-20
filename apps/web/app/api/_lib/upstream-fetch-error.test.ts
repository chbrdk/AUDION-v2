import { describe, expect, it } from "vitest";

import { describePersonaUpstreamFetchError } from "./upstream-fetch-error";

describe("describePersonaUpstreamFetchError", () => {
  it("extracts ECONNREFUSED and adds hint", () => {
    const inner = Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED", errno: -111 });
    const err = new TypeError("fetch failed", { cause: inner });
    const out = describePersonaUpstreamFetchError(err);
    expect(out.message).toBe("fetch failed");
    expect(out.code).toBe("ECONNREFUSED");
    expect(out.hint).toContain("NEXT_PERSONA_BACKEND_INTERNAL_URL");
  });

  it("handles unknown errors", () => {
    expect(describePersonaUpstreamFetchError("x")).toEqual({
      message: "Upstream request failed",
      code: undefined,
      hint: undefined,
    });
  });
});
