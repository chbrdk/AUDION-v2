import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { translatePersonaAdminFields } from "./persona-translate-fields";

describe("translatePersonaAdminFields", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ strings: { headline: "DE Kopfzeile" } }),
      } as Response)
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs JSON and returns strings", async () => {
    const out = await translatePersonaAdminFields("p-1", {
      fromLocale: "en",
      strings: { headline: "EN" },
    });
    expect(out.strings.headline).toBe("DE Kopfzeile");
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/persona-admin/p-1/translate-fields");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ from_locale: "en", strings: { headline: "EN" } });
  });
});
