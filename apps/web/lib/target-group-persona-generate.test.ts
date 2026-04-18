import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { generateTargetGroupPersona } from "../app/api/_lib/target-group";

describe("generateTargetGroupPersona request body", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: "p1" }), {
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

  it("omits output_locale when outputLocale is not passed (bilingual EN profile path)", async () => {
    await generateTargetGroupPersona("00000000-0000-4000-8000-000000000001", {
      segment: "Buyers",
      filterMode: "auto",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.output_locale).toBeUndefined();
    expect(body.segment).toBe("Buyers");
    expect(body.filter_mode).toBe("auto");
  });

  it("merges output_locale when outputLocale is set", async () => {
    await generateTargetGroupPersona("00000000-0000-4000-8000-000000000001", {
      segment: "Buyers",
      filterMode: "auto",
      outputLocale: "de",
    });
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.output_locale).toBe("de");
  });
});
