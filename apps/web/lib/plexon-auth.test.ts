import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function loadPlexonAuth() {
  vi.resetModules();
  return import("./plexon-auth");
}

describe("validatePlexonCredentials", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("returns invalid_credentials on PLEXON 401 Invalid credentials", async () => {
    vi.stubEnv("PLEXON_AUTH_URL", "https://plexon.test");
    vi.stubEnv("PLEXON_SERVICE_SECRET", "test-secret-16chars");
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401 })
    );
    const { validatePlexonCredentials } = await loadPlexonAuth();
    const r = await validatePlexonCredentials("a@b.com", "pw");
    expect(r).toEqual({ ok: false, reason: "invalid_credentials" });
  });

  it("returns service_secret_mismatch on PLEXON 401 Unauthorized", async () => {
    vi.stubEnv("PLEXON_AUTH_URL", "https://plexon.test");
    vi.stubEnv("PLEXON_SERVICE_SECRET", "test-secret-16chars");
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    );
    const { validatePlexonCredentials } = await loadPlexonAuth();
    const r = await validatePlexonCredentials("a@b.com", "pw");
    expect(r).toEqual({ ok: false, reason: "service_secret_mismatch" });
  });

  it("returns ok with user on 200", async () => {
    vi.stubEnv("PLEXON_AUTH_URL", "https://plexon.test");
    vi.stubEnv("PLEXON_SERVICE_SECRET", "test-secret-16chars");
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user: { id: "u1", email: "a@b.com", name: "N" } }), { status: 200 })
    );
    const { validatePlexonCredentials } = await loadPlexonAuth();
    const r = await validatePlexonCredentials("a@b.com", "pw");
    expect(r).toEqual({ ok: true, user: { id: "u1", email: "a@b.com", name: "N" } });
  });

  it("returns not_configured when env missing", async () => {
    vi.unstubAllEnvs();
    const { validatePlexonCredentials } = await loadPlexonAuth();
    const r = await validatePlexonCredentials("a@b.com", "pw");
    expect(r).toEqual({ ok: false, reason: "not_configured" });
  });
});

describe("plexonUserDisplayNameForAudion", () => {
  it("uses PLEXON name when present", async () => {
    const { plexonUserDisplayNameForAudion } = await loadPlexonAuth();
    expect(plexonUserDisplayNameForAudion("  Ada  ", "a@b.com")).toBe("Ada");
  });

  it("falls back to local part of email when name missing", async () => {
    const { plexonUserDisplayNameForAudion } = await loadPlexonAuth();
    expect(plexonUserDisplayNameForAudion(undefined, "ada.lovelace@b.com")).toBe("ada.lovelace");
  });

  it("falls back to User when neither name nor local part", async () => {
    const { plexonUserDisplayNameForAudion } = await loadPlexonAuth();
    expect(plexonUserDisplayNameForAudion(undefined, "@b.com")).toBe("User");
  });

  it("getPlexonAuthHealthSnapshot reflects env at call time", async () => {
    vi.stubEnv("PLEXON_AUTH_URL", "https://plexon.test");
    vi.stubEnv("PLEXON_SERVICE_SECRET", "x");
    const { getPlexonAuthHealthSnapshot } = await loadPlexonAuth();
    expect(getPlexonAuthHealthSnapshot()).toEqual({
      plexonAuthUrlSet: true,
      plexonServiceSecretSet: true,
      plexonAuthActive: true,
    });
    vi.stubEnv("PLEXON_AUTH_URL", "");
    const { getPlexonAuthHealthSnapshot: snap2 } = await loadPlexonAuth();
    expect(snap2().plexonAuthActive).toBe(false);
  });
});
