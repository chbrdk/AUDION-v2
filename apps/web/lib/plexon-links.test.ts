import { afterEach, describe, expect, it, vi } from "vitest";

describe("AUDION PLEXON return links", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("accepts return URLs from the configured PLEXON origin", async () => {
    vi.stubEnv("NEXT_PUBLIC_PLEXON_REGISTER_URL", "https://plexon.example.com/register");
    const { normalizePlexonReturnTo } = await import("./plexon-links");
    expect(normalizePlexonReturnTo("https://plexon.example.com/products")).toBe("https://plexon.example.com/products");
    expect(normalizePlexonReturnTo("https://evil.example.com/products")).toBeNull();
  });

  it("rejects return URLs when no PLEXON origin is configured", async () => {
    const { normalizePlexonReturnTo } = await import("./plexon-links");
    expect(normalizePlexonReturnTo("https://plexon.example.com/products")).toBeNull();
  });

  it("extracts a federated return target from redirect query strings", async () => {
    vi.stubEnv("NEXT_PUBLIC_PLEXON_REGISTER_URL", "https://plexon.example.com/register");
    const { extractPlexonReturnToFromRedirect } = await import("./plexon-links");
    expect(
      extractPlexonReturnToFromRedirect(
        "/admin?plexon_source=plexon&plexon_return_to=https%3A%2F%2Fplexon.example.com%2Fproducts"
      )
    ).toBe("https://plexon.example.com/products");
  });
});
