import { PLEXON_FEDERATION_CONTRACT_VERSION } from "./plexon-contract";

const APP_VERSION_FALLBACK = "0.1.0";
const COMMIT_SHA_KEYS = ["SOURCE_COMMIT", "COMMIT_SHA", "GIT_COMMIT_SHA", "VERCEL_GIT_COMMIT_SHA"] as const;
const BRANCH_KEYS = ["SOURCE_BRANCH", "GIT_BRANCH", "VERCEL_GIT_COMMIT_REF", "BRANCH"] as const;
const BUILD_ID_KEYS = ["BUILD_ID", "NEXT_BUILD_ID", "VERCEL_DEPLOYMENT_ID"] as const;
const BUILT_AT_KEYS = ["BUILD_TIME", "BUILD_TIMESTAMP", "SOURCE_DATE", "SOURCE_DATE_EPOCH"] as const;

function readFirstEnv(keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return null;
}

function normalizeBuiltAt(value: string | null): string | null {
  if (!value) return null;
  if (!/^\d+$/.test(value)) return value;

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;

  const milliseconds = value.length >= 13 ? numeric : numeric * 1000;
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

export function getRuntimeMetadata() {
  return {
    app: "audion-web",
    runtime: "nextjs",
    version: process.env.npm_package_version?.trim() || APP_VERSION_FALLBACK,
    nodeEnv: process.env.NODE_ENV?.trim() || null,
    federationContractVersion: PLEXON_FEDERATION_CONTRACT_VERSION,
    deployment: {
      commitSha: readFirstEnv(COMMIT_SHA_KEYS),
      branch: readFirstEnv(BRANCH_KEYS),
      buildId: readFirstEnv(BUILD_ID_KEYS),
      builtAt: normalizeBuiltAt(readFirstEnv(BUILT_AT_KEYS)),
    },
  };
}
