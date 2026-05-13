import { describe, expect, it, beforeEach, vi } from "vitest";

import {
  PLATFORM_COMPANY_ID_STORAGE_KEY,
  extractPlatformCompanyIdFromSearchParams,
  persistPlatformCompanyIdFromUrl,
  readPlatformCompanyIdFromSessionStorage,
  resolvePlatformCompanyIdForApi,
} from "./platform-company-context";

describe("platform-company-context", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
      },
    });
  });

  it("extracts from supported query keys", () => {
    expect(extractPlatformCompanyIdFromSearchParams(new URLSearchParams("platformCompanyId=co-1"))).toBe("co-1");
    expect(extractPlatformCompanyIdFromSearchParams(new URLSearchParams("platform_company_id=co-2"))).toBe("co-2");
    expect(extractPlatformCompanyIdFromSearchParams(new URLSearchParams())).toBeNull();
  });

  it("persistPlatformCompanyIdFromUrl writes sessionStorage", () => {
    persistPlatformCompanyIdFromUrl(new URLSearchParams("platformCompanyId=co-99"));
    expect(window.sessionStorage.setItem).toHaveBeenCalledWith(PLATFORM_COMPANY_ID_STORAGE_KEY, "co-99");
  });

  it("resolvePlatformCompanyIdForApi prefers URL over storage", () => {
    vi.mocked(window.sessionStorage.getItem).mockReturnValue("stored-co");
    expect(resolvePlatformCompanyIdForApi(new URLSearchParams("platform_company_id=url-co"))).toBe("url-co");
  });

  it("resolvePlatformCompanyIdForApi falls back to sessionStorage", () => {
    vi.mocked(window.sessionStorage.getItem).mockReturnValue("stored-only");
    expect(resolvePlatformCompanyIdForApi(new URLSearchParams())).toBe("stored-only");
  });

  it("resolvePlatformCompanyIdForApi falls back to NEXT_PUBLIC_DEFAULT_PLATFORM_COMPANY_ID", () => {
    vi.mocked(window.sessionStorage.getItem).mockReturnValue(null);
    vi.stubEnv("NEXT_PUBLIC_DEFAULT_PLATFORM_COMPANY_ID", "env-default");
    expect(resolvePlatformCompanyIdForApi(new URLSearchParams())).toBe("env-default");
  });
});
