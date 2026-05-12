import { afterEach, describe, expect, it, vi } from "vitest";

describe("AUDION runtime metadata", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("exposes app metadata and the federation contract version", async () => {
    const { getRuntimeMetadata } = await import("./runtime-metadata");
    expect(getRuntimeMetadata()).toMatchObject({
      app: "audion-web",
      runtime: "nextjs",
      version: "0.1.0",
      federationContractVersion: "2026-05-plexon-federation-v2",
    });
  });

  it("prefers populated deployment env values and normalizes SOURCE_DATE_EPOCH", async () => {
    vi.stubEnv("SOURCE_COMMIT", "abc123");
    vi.stubEnv("SOURCE_BRANCH", "main");
    vi.stubEnv("BUILD_ID", "deploy-42");
    vi.stubEnv("SOURCE_DATE_EPOCH", "1715529600");

    const { getRuntimeMetadata } = await import("./runtime-metadata");
    expect(getRuntimeMetadata().deployment).toEqual({
      commitSha: "abc123",
      branch: "main",
      buildId: "deploy-42",
      builtAt: "2024-05-12T16:00:00.000Z",
    });
  });
});
