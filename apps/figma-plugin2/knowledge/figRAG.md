# Figma Library-First AI Design System — Architecture V3

> **Version**: 3.0 — Lean Stack with Tests & Edge Cases
> **Purpose**: AI-powered Figma plugin that composes designs from existing Figma Library components via RAG-backed Claude API.
> **Stack**: Figma Plugin (TypeScript) → Node.js API (Coolify/Hetzner) → PostgreSQL + pgvector → Claude API
> **Target**: Handoff document for implementation in Cursor.

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FIGMA PLUGIN (audion)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────────┐ │
│  │   Chat UI     │  │  Page/Frame  │  │   Instance Renderer       │ │
│  │   (iframe)    │  │  Context     │  │   (Plugin Sandbox)        │ │
│  │              │  │  Reader      │  │   importComponentByKey... │ │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬───────────────┘ │
└─────────┼─────────────────┼───────────────────────┼──────────────────┘
          │                 │                       ▲
          ▼                 ▼                       │ Composition JSON
┌─────────────────────────────────────────────────────────────────────┐
│                   COOLIFY BACKEND (Hetzner VPS)                     │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Node.js API (Express)                     │   │
│  │                                                             │   │
│  │  Routes          Crawler          Composer       Scheduler  │   │
│  │  /compose        FigmaClient      RAG Retrieve   node-cron │   │
│  │  /catalog        Extractors       Prompt Build   (weekly    │   │
│  │  /crawl          Enrichment       Claude Call     re-crawl) │   │
│  │  /health         Embedder         Validator                 │   │
│  └──────────────────────┬──────────────────────────────────────┘   │
│                         │                                           │
│  ┌──────────────────────▼──────────────────────────────────────┐   │
│  │              PostgreSQL 16 + pgvector                        │   │
│  │  component_catalog · component_embeddings · crawl_logs      │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
          │
          ▼
   Claude API (claude-sonnet-4-20250514)
   OpenAI (text-embedding-3-small, 1536 dim)
```

### Request Flow

```
1. User: "Erstelle eine Landing Page für KSB Industriepumpen"
2. Plugin UI → POST /api/v1/compose { prompt, projectId, slideContext? }
3. Backend:
   a. Semantic search pgvector → top 20-25 relevant components
   b. Build system prompt with component catalog subset
   c. Call Claude API → receive Composition JSON
   d. Validate: all referenced components exist, properties valid
   e. Resolve component names → Figma keys
   f. Return enriched Composition JSON to plugin
4. Plugin sandbox:
   a. importComponentSetByKeyAsync() for each component
   b. Create instances, set variant properties
   c. Build layout frames (sections, groups, grids)
   d. Position on canvas, zoom into view
```

---

## 2. Backend (Node.js on Coolify)

### 2.1 Project Structure

```
audion-api/
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .env.example
│
├── src/
│   ├── index.ts                      # Server entry
│   ├── config.ts                     # Environment config with validation
│   ├── routes/
│   │   ├── compose.ts                # POST /compose, POST /compose/iterate
│   │   ├── catalog.ts                # GET /catalog/:projectId, GET /catalog/:projectId/search
│   │   ├── crawl.ts                  # POST /crawl, GET /crawl/status/:id
│   │   ├── health.ts                 # GET /health (for Coolify health checks)
│   │   └── index.ts                  # Route registration
│   │
│   ├── figma/
│   │   ├── client.ts                 # Figma REST API client with retry + rate limiting
│   │   ├── client.test.ts
│   │   └── types.ts                  # Figma API response types
│   │
│   ├── crawler/
│   │   ├── pipeline.ts               # Crawl orchestration
│   │   ├── pipeline.test.ts
│   │   ├── extractors.ts             # Property/variant extraction from Figma nodes
│   │   ├── extractors.test.ts
│   │   ├── enrichment.ts             # Claude-based usage hint generation
│   │   ├── enrichment.test.ts
│   │   └── scheduler.ts              # node-cron for periodic re-crawls
│   │
│   ├── rag/
│   │   ├── embeddings.ts             # Embedding generation (OpenAI)
│   │   ├── embeddings.test.ts
│   │   ├── retrieval.ts              # Semantic + hybrid search
│   │   ├── retrieval.test.ts
│   │   └── searchAnalyzer.ts         # Prompt → component need analysis
│   │
│   ├── composer/
│   │   ├── compose.ts                # Main composition pipeline
│   │   ├── compose.test.ts
│   │   ├── prompt.ts                 # System prompt builder
│   │   ├── prompt.test.ts
│   │   ├── validator.ts              # Composition JSON validation
│   │   ├── validator.test.ts
│   │   ├── resolver.ts               # Component name → key resolution
│   │   └── resolver.test.ts
│   │
│   ├── db/
│   │   ├── pool.ts                   # PostgreSQL connection pool
│   │   ├── migrate.ts                # Migration runner (no ORM)
│   │   └── migrations/
│   │       ├── 001_initial.sql
│   │       ├── 002_embeddings.sql
│   │       ├── 003_catalog_categories.sql
│   │       └── 004_openai_embeddings.sql
│   │
│   ├── middleware/
│   │   ├── auth.ts                   # Plugin token verification
│   │   ├── rateLimit.ts              # Per-project request limiting
│   │   └── errorHandler.ts           # Global error handler with typed errors
│   │
│   └── lib/
│       ├── errors.ts                 # Custom error classes
│       ├── retry.ts                  # Generic retry with exponential backoff
│       ├── chunk.ts                  # Array chunking utility
│       └── color.ts                  # Hex ↔ RGB conversion
│
├── tests/
│   ├── setup.ts                      # Test database setup/teardown
│   ├── fixtures/
│   │   ├── figma-components.json     # Mocked Figma API response
│   │   ├── figma-component-sets.json
│   │   ├── figma-nodes.json          # Node detail response with properties
│   │   ├── catalog-entries.json      # Pre-built catalog for testing
│   │   ├── compositions/
│   │   │   ├── landing-page.json     # Valid composition
│   │   │   ├── empty-page.json       # Edge case: no children
│   │   │   ├── deep-nesting.json     # Edge case: 10+ levels deep
│   │   │   ├── unknown-component.json # Edge case: invalid component ref
│   │   │   └── malformed.json        # Edge case: broken JSON from LLM
│   │   └── prompts/
│   │       ├── landing-page-de.txt   # German prompt
│   │       ├── landing-page-en.txt
│   │       ├── vague-prompt.txt      # "Make something nice"
│   │       └── modification.txt      # "Make the hero bigger"
│   │
│   ├── integration/
│   │   ├── crawl.test.ts             # Full crawl pipeline with mocked Figma API
│   │   ├── compose.test.ts           # Full compose flow with mocked Claude
│   │   ├── rag.test.ts               # Embedding + retrieval roundtrip
│   │   └── api.test.ts               # HTTP endpoint tests
│   │
│   └── e2e/
│       └── smoke.test.ts             # Against real APIs (CI skip, manual run)
│
└── scripts/
    ├── seed.ts                       # Seed database with test data
    ├── crawl-cli.ts                  # Manual crawl trigger: npx ts-node scripts/crawl-cli.ts <fileKey>
    └── migrate.ts                    # Run migrations: npx ts-node scripts/migrate.ts
```

### 2.2 Config with Validation

```typescript
// src/config.ts

import { z } from "zod";

const configSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Database
  DATABASE_URL: z.string().url(),

  // Anthropic
  ANTHROPIC_API_KEY: z.string().startsWith("sk-ant-"),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-4-20250514"),
  ANTHROPIC_MAX_TOKENS: z.coerce.number().default(4096),

  // Figma
  FIGMA_PAT: z.string().startsWith("figd_"),
  FIGMA_PAT_EXPIRES: z.string().date().optional(), // ISO date string
  FIGMA_RATE_LIMIT_PER_MINUTE: z.coerce.number().default(10),

  // Embeddings
  OPENAI_API_KEY: z.string().optional(),
  EMBEDDING_DIMENSION: z.coerce.number().default(1024),

  // Auth
  PLUGIN_API_SECRET: z.string().min(32),

  // Scheduler
  CRAWL_CRON: z.string().default("0 3 * * 1"), // Weekly Monday 3am
  CRAWL_ENABLED: z.coerce.boolean().default(true),
});

export type Config = z.infer<typeof configSchema>;

let _config: Config;

export function getConfig(): Config {
  if (!_config) {
    const result = configSchema.safeParse(process.env);
    if (!result.success) {
      console.error("Invalid configuration:", result.error.format());
      process.exit(1);
    }
    _config = result.data;

    // PAT expiry warning
    if (_config.FIGMA_PAT_EXPIRES) {
      const expiresAt = new Date(_config.FIGMA_PAT_EXPIRES);
      const daysUntilExpiry = Math.ceil(
        (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntilExpiry <= 7) {
        console.warn(
          `⚠️  Figma PAT expires in ${daysUntilExpiry} days! Rotate at: Figma Settings → Security → Personal Access Tokens`
        );
      }
      if (daysUntilExpiry <= 0) {
        console.error("🚨 Figma PAT has expired! Crawl and compose will fail.");
      }
    }
  }
  return _config;
}
```

### 2.3 Server Entry with Scheduler

```typescript
// src/index.ts

import express from "express";
import cron from "node-cron";
import cors from "cors";
import { getConfig } from "./config";
import { registerRoutes } from "./routes";
import { errorHandler } from "./middleware/errorHandler";
import { runMigrations } from "./db/migrate";
import { runScheduledCrawls } from "./crawler/scheduler";
import { getPool } from "./db/pool";

async function main() {
  const config = getConfig();

  // Run DB migrations
  await runMigrations();

  const app = express();

  // CORS: only allow Figma plugin iframe + own domains
  app.use(cors({
    origin: [
      "https://www.figma.com",
      "null", // Figma plugin sandbox origin
      ...(config.NODE_ENV === "development" ? ["http://localhost:*"] : []),
    ],
    credentials: true,
  }));

  app.use(express.json({ limit: "1mb" }));

  registerRoutes(app);

  app.use(errorHandler);

  // Scheduled re-crawl (replaces n8n)
  if (config.CRAWL_ENABLED && config.NODE_ENV !== "test") {
    cron.schedule(config.CRAWL_CRON, async () => {
      console.log(`[Scheduler] Starting scheduled crawl at ${new Date().toISOString()}`);
      try {
        await runScheduledCrawls();
      } catch (err) {
        console.error("[Scheduler] Crawl failed:", err);
      }
    });
    console.log(`[Scheduler] Crawl scheduled: ${config.CRAWL_CRON}`);
  }

  app.listen(config.PORT, () => {
    console.log(`[Server] Running on port ${config.PORT} (${config.NODE_ENV})`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log("[Server] Shutting down...");
    const pool = getPool();
    await pool.end();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
```

### 2.4 Scheduler (replaces n8n)

```typescript
// src/crawler/scheduler.ts

import { getPool } from "../db/pool";
import { crawlLibrary } from "./pipeline";

/**
 * Runs crawls for all configured projects.
 * Called by node-cron on the configured schedule.
 * Also callable via POST /api/v1/crawl for manual triggers.
 */
export async function runScheduledCrawls(): Promise<void> {
  const db = getPool();

  const projects = await db.query(
    "SELECT id, figma_file_key FROM projects WHERE active = true"
  );

  for (const project of projects.rows) {
    try {
      console.log(`[Crawler] Starting crawl for project ${project.id}`);
      await crawlLibrary({
        projectId: project.id,
        fileKey: project.figma_file_key,
        enrichWithLLM: true,
        includeThumbnails: true,
      });
      console.log(`[Crawler] Completed crawl for project ${project.id}`);
    } catch (err) {
      console.error(`[Crawler] Failed for project ${project.id}:`, err);
      await db.query(
        `INSERT INTO crawl_logs (project_id, status, error_message)
         VALUES ($1, 'failed', $2)`,
        [project.id, err instanceof Error ? err.message : "Unknown error"]
      );
    }
  }
}
```

---

## 3. Figma REST API Client

```typescript
// src/figma/client.ts

import { getConfig } from "../config";
import { retryWithBackoff } from "../lib/retry";
import {
  FigmaRateLimitError,
  FigmaAuthError,
  FigmaNotFoundError,
} from "../lib/errors";

interface RequestOptions {
  maxRetries?: number;
  timeout?: number;
}

export class FigmaClient {
  private pat: string;
  private baseUrl = "https://api.figma.com/v1";

  // Sliding window rate limiter
  private requestTimestamps: number[] = [];
  private maxPerMinute: number;

  constructor() {
    const config = getConfig();
    this.pat = config.FIGMA_PAT;
    this.maxPerMinute = config.FIGMA_RATE_LIMIT_PER_MINUTE;
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    // Remove timestamps older than 1 minute
    this.requestTimestamps = this.requestTimestamps.filter(
      t => now - t < 60_000
    );

    if (this.requestTimestamps.length >= this.maxPerMinute) {
      const oldestInWindow = this.requestTimestamps[0];
      const waitMs = 60_000 - (now - oldestInWindow) + 100; // +100ms buffer
      console.log(`[FigmaClient] Rate limit: waiting ${waitMs}ms`);
      await new Promise(r => setTimeout(r, waitMs));
    }

    this.requestTimestamps.push(Date.now());
  }

  private async request<T>(
    path: string,
    params?: Record<string, string>,
    opts?: RequestOptions
  ): Promise<T> {
    await this.throttle();

    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    return retryWithBackoff(
      async () => {
        const controller = new AbortController();
        const timeout = setTimeout(
          () => controller.abort(),
          opts?.timeout ?? 30_000
        );

        try {
          const response = await fetch(url.toString(), {
            headers: { "X-Figma-Token": this.pat },
            signal: controller.signal,
          });

          if (response.status === 429) {
            const retryAfter = parseInt(
              response.headers.get("Retry-After") ?? "60"
            );
            const rateLimitType = response.headers.get("X-Figma-Rate-Limit-Type");
            throw new FigmaRateLimitError(retryAfter, rateLimitType ?? "unknown");
          }

          if (response.status === 403) {
            throw new FigmaAuthError("Invalid or expired Figma PAT");
          }

          if (response.status === 404) {
            throw new FigmaNotFoundError(`Not found: ${path}`);
          }

          if (!response.ok) {
            throw new Error(`Figma API ${response.status}: ${await response.text()}`);
          }

          return (await response.json()) as T;
        } finally {
          clearTimeout(timeout);
        }
      },
      {
        maxRetries: opts?.maxRetries ?? 3,
        baseDelay: 1000,
        shouldRetry: (err) => {
          // Retry on rate limit and transient errors, not on auth/404
          if (err instanceof FigmaRateLimitError) return true;
          if (err instanceof FigmaAuthError) return false;
          if (err instanceof FigmaNotFoundError) return false;
          return true;
        },
        onRetry: (err, attempt) => {
          if (err instanceof FigmaRateLimitError) {
            console.warn(
              `[FigmaClient] Rate limited (${err.limitType}). ` +
              `Retry ${attempt} after ${err.retryAfterSeconds}s`
            );
          }
        },
      }
    );
  }

  // ── Endpoints ───────────────────────────────────────────────────

  async getFileComponents(fileKey: string) {
    return this.request<FigmaComponentsResponse>(
      `/files/${fileKey}/components`
    );
  }

  async getFileComponentSets(fileKey: string) {
    return this.request<FigmaComponentSetsResponse>(
      `/files/${fileKey}/component_sets`
    );
  }

  async getFileNodes(fileKey: string, nodeIds: string[]) {
    return this.request<FigmaNodesResponse>(
      `/files/${fileKey}/nodes`,
      { ids: nodeIds.join(",") },
      { timeout: 60_000 } // Node fetches can be slow for large files
    );
  }

  async getImages(fileKey: string, nodeIds: string[], scale = 2) {
    return this.request<FigmaImagesResponse>(
      `/images/${fileKey}`,
      { ids: nodeIds.join(","), scale: scale.toString(), format: "png" }
    );
  }
}
```

### Retry Utility

```typescript
// src/lib/retry.ts

interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay?: number;
  shouldRetry?: (error: Error) => boolean;
  onRetry?: (error: Error, attempt: number) => void;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  opts: RetryOptions
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt === opts.maxRetries) break;
      if (opts.shouldRetry && !opts.shouldRetry(lastError)) break;

      const delay = Math.min(
        opts.baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
        opts.maxDelay ?? 60_000
      );

      opts.onRetry?.(lastError, attempt + 1);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  throw lastError!;
}
```

### Custom Errors

```typescript
// src/lib/errors.ts

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = "INTERNAL_ERROR"
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class FigmaRateLimitError extends AppError {
  constructor(
    public retryAfterSeconds: number,
    public limitType: string
  ) {
    super(
      `Figma rate limit hit (${limitType}). Retry after ${retryAfterSeconds}s`,
      429,
      "FIGMA_RATE_LIMIT"
    );
  }
}

export class FigmaAuthError extends AppError {
  constructor(message: string) {
    super(message, 401, "FIGMA_AUTH_ERROR");
  }
}

export class FigmaNotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404, "FIGMA_NOT_FOUND");
  }
}

export class CrawlError extends AppError {
  constructor(message: string, public stage: string) {
    super(message, 500, "CRAWL_ERROR");
  }
}

export class CompositionError extends AppError {
  constructor(message: string) {
    super(message, 422, "COMPOSITION_ERROR");
  }
}

export class ComponentNotFoundError extends CompositionError {
  constructor(
    public componentName: string,
    public availableComponents: string[]
  ) {
    super(
      `Component "${componentName}" not found. Available: ${availableComponents.slice(0, 10).join(", ")}` +
      (availableComponents.length > 10 ? ` (+${availableComponents.length - 10} more)` : "")
    );
  }
}

export class InvalidVariantError extends CompositionError {
  constructor(
    public componentName: string,
    public propertyName: string,
    public invalidValue: string,
    public validOptions: string[]
  ) {
    super(
      `Invalid variant "${invalidValue}" for ${componentName}.${propertyName}. ` +
      `Valid options: ${validOptions.join(", ")}`
    );
  }
}

export class LLMResponseError extends AppError {
  constructor(
    message: string,
    public rawResponse: string
  ) {
    super(message, 502, "LLM_RESPONSE_ERROR");
  }
}
```

---

## 4. Crawler Pipeline

```typescript
// src/crawler/pipeline.ts

import { FigmaClient } from "../figma/client";
import { getPool } from "../db/pool";
import { extractPropertyDefinitions, extractVariantCombinations, buildSearchText } from "./extractors";
import { enrichCatalogWithLLM } from "./enrichment";
import { generateEmbeddings } from "../rag/embeddings";
import { chunk } from "../lib/chunk";
import { CrawlError } from "../lib/errors";

export interface CrawlConfig {
  projectId: string;
  fileKey: string;
  enrichWithLLM?: boolean;
  includeThumbnails?: boolean;
}

export interface CrawlResult {
  projectId: string;
  componentCount: number;
  componentSetCount: number;
  errors: CrawlStageError[];
  durationMs: number;
}

interface CrawlStageError {
  stage: string;
  componentName?: string;
  message: string;
}

export async function crawlLibrary(config: CrawlConfig): Promise<CrawlResult> {
  const startTime = Date.now();
  const client = new FigmaClient();
  const db = getPool();
  const errors: CrawlStageError[] = [];

  // Log crawl start
  const crawlLog = await db.query(
    `INSERT INTO crawl_logs (project_id, status) VALUES ($1, 'running') RETURNING id`,
    [config.projectId]
  );
  const crawlId = crawlLog.rows[0].id;

  try {
    // ── Stage 1: Fetch Component Metadata ──────────────────────
    let componentSetsResponse;
    let componentsResponse;

    try {
      componentSetsResponse = await client.getFileComponentSets(config.fileKey);
    } catch (err) {
      throw new CrawlError(
        `Failed to fetch component sets: ${err instanceof Error ? err.message : err}`,
        "fetch_component_sets"
      );
    }

    try {
      componentsResponse = await client.getFileComponents(config.fileKey);
    } catch (err) {
      throw new CrawlError(
        `Failed to fetch components: ${err instanceof Error ? err.message : err}`,
        "fetch_components"
      );
    }

    const componentSets = componentSetsResponse.meta?.component_sets ?? [];
    const components = componentsResponse.meta?.components ?? [];

    // ── Edge Case: Empty library ───────────────────────────────
    if (componentSets.length === 0 && components.length === 0) {
      await updateCrawlLog(db, crawlId, "completed", 0);
      return {
        projectId: config.projectId,
        componentCount: 0,
        componentSetCount: 0,
        errors: [{ stage: "fetch", message: "Library contains no published components" }],
        durationMs: Date.now() - startTime,
      };
    }

    // ── Stage 2: Fetch Node Details (for property definitions) ─
    const componentSetNodeIds = componentSets.map((cs: any) => cs.node_id);
    const standaloneComponents = components.filter(
      (c: any) => !c.containing_frame?.containingComponentSet
    );
    const standaloneNodeIds = standaloneComponents.map((c: any) => c.node_id);
    const allNodeIds = [...componentSetNodeIds, ...standaloneNodeIds];

    const nodeDetails: Record<string, any> = {};
    for (const batch of chunk(allNodeIds, 30)) {
      try {
        const result = await client.getFileNodes(config.fileKey, batch);
        if (result.nodes) {
          Object.assign(nodeDetails, result.nodes);
        }
      } catch (err) {
        errors.push({
          stage: "fetch_nodes",
          message: `Failed to fetch node batch: ${err instanceof Error ? err.message : err}`,
        });
        // Continue with partial data rather than failing entirely
      }
      // Courtesy delay between batches
      await sleep(1500);
    }

    // ── Stage 3: Build Catalog ─────────────────────────────────
    const catalog: ComponentCatalogEntry[] = [];

    for (const cs of componentSets) {
      try {
        const nodeData = nodeDetails[cs.node_id]?.document;
        const properties = nodeData
          ? extractPropertyDefinitions(nodeData)
          : {};
        const variants = extractVariantCombinations(cs, components);

        catalog.push({
          componentType: "component_set",
          name: cs.name,
          key: cs.key,
          nodeId: cs.node_id,
          fileKey: config.fileKey,
          description: cs.description ?? "",
          properties,
          variants,
          variantCount: variants.length,
          searchText: buildSearchText(cs.name, cs.description, properties, variants),
        });
      } catch (err) {
        errors.push({
          stage: "build_catalog",
          componentName: cs.name,
          message: `Failed to process component set: ${err instanceof Error ? err.message : err}`,
        });
      }
    }

    for (const c of standaloneComponents) {
      try {
        const nodeData = nodeDetails[c.node_id]?.document;
        catalog.push({
          componentType: "component",
          name: c.name,
          key: c.key,
          nodeId: c.node_id,
          fileKey: config.fileKey,
          description: c.description ?? "",
          properties: nodeData ? extractPropertyDefinitions(nodeData) : {},
          variants: [],
          variantCount: 0,
          searchText: buildSearchText(c.name, c.description, {}, []),
        });
      } catch (err) {
        errors.push({
          stage: "build_catalog",
          componentName: c.name,
          message: `Failed to process component: ${err instanceof Error ? err.message : err}`,
        });
      }
    }

    // ── Edge Case: All components failed to process ────────────
    if (catalog.length === 0 && (componentSets.length > 0 || components.length > 0)) {
      throw new CrawlError(
        `All ${componentSets.length + components.length} components failed processing. Check node access.`,
        "build_catalog"
      );
    }

    // ── Stage 4: Thumbnails (optional) ─────────────────────────
    if (config.includeThumbnails) {
      const thumbnailNodeIds = catalog.map(c => c.nodeId);
      for (const batch of chunk(thumbnailNodeIds, 30)) {
        try {
          const images = await client.getImages(config.fileKey, batch);
          if (images.images) {
            for (const [nodeId, url] of Object.entries(images.images)) {
              const entry = catalog.find(c => c.nodeId === nodeId);
              if (entry && url) entry.thumbnailUrl = url as string;
            }
          }
        } catch (err) {
          errors.push({
            stage: "thumbnails",
            message: `Failed to fetch thumbnail batch: ${err instanceof Error ? err.message : err}`,
          });
          // Non-critical, continue
        }
        await sleep(2000);
      }
    }

    // ── Stage 5: LLM Enrichment (optional) ─────────────────────
    if (config.enrichWithLLM) {
      try {
        await enrichCatalogWithLLM(catalog);
      } catch (err) {
        errors.push({
          stage: "enrichment",
          message: `LLM enrichment failed: ${err instanceof Error ? err.message : err}`,
        });
        // Non-critical, continue with unenriched data
      }
    }

    // ── Stage 6: Store + Embed ─────────────────────────────────
    await storeCatalog(db, config.projectId, catalog);
    await generateEmbeddings(db, config.projectId, catalog);

    // ── Done ───────────────────────────────────────────────────
    await updateCrawlLog(db, crawlId, "completed", catalog.length);

    return {
      projectId: config.projectId,
      componentCount: standaloneComponents.length,
      componentSetCount: componentSets.length,
      errors,
      durationMs: Date.now() - startTime,
    };

  } catch (err) {
    await updateCrawlLog(
      db, crawlId, "failed", 0,
      err instanceof Error ? err.message : "Unknown error"
    );
    throw err;
  }
}

async function storeCatalog(
  db: any,
  projectId: string,
  catalog: ComponentCatalogEntry[]
): Promise<void> {
  // Upsert: update existing, insert new, mark missing as inactive
  const existingKeys = new Set(
    (await db.query(
      "SELECT key FROM component_catalog WHERE project_id = $1",
      [projectId]
    )).rows.map((r: any) => r.key)
  );

  const newKeys = new Set(catalog.map(c => c.key));

  // Mark removed components (soft delete)
  const removedKeys = [...existingKeys].filter(k => !newKeys.has(k));
  if (removedKeys.length > 0) {
    await db.query(
      `UPDATE component_catalog SET active = false, updated_at = NOW()
       WHERE project_id = $1 AND key = ANY($2)`,
      [projectId, removedKeys]
    );
  }

  // Upsert catalog entries
  for (const entry of catalog) {
    await db.query(
      `INSERT INTO component_catalog (
        project_id, component_type, name, key, node_id, file_key,
        description, properties, variants, variant_count,
        thumbnail_url, usage_hint, common_contexts, default_variant,
        search_text, active, crawled_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,true,NOW())
      ON CONFLICT (project_id, key)
      DO UPDATE SET
        name = EXCLUDED.name,
        component_type = EXCLUDED.component_type,
        description = EXCLUDED.description,
        properties = EXCLUDED.properties,
        variants = EXCLUDED.variants,
        variant_count = EXCLUDED.variant_count,
        thumbnail_url = COALESCE(EXCLUDED.thumbnail_url, component_catalog.thumbnail_url),
        usage_hint = COALESCE(EXCLUDED.usage_hint, component_catalog.usage_hint),
        common_contexts = COALESCE(EXCLUDED.common_contexts, component_catalog.common_contexts),
        default_variant = COALESCE(EXCLUDED.default_variant, component_catalog.default_variant),
        search_text = EXCLUDED.search_text,
        active = true,
        crawled_at = NOW(),
        updated_at = NOW()`,
      [
        projectId, entry.componentType, entry.name, entry.key,
        entry.nodeId, entry.fileKey, entry.description,
        JSON.stringify(entry.properties), JSON.stringify(entry.variants),
        entry.variantCount, entry.thumbnailUrl ?? null,
        entry.usageHint ?? null, entry.commonContexts ?? [],
        entry.defaultVariant ?? null, entry.searchText,
      ]
    );
  }
}

async function updateCrawlLog(
  db: any, crawlId: number, status: string,
  count: number, errorMessage?: string
): Promise<void> {
  await db.query(
    `UPDATE crawl_logs SET status = $1, component_count = $2,
     error_message = $3, completed_at = NOW()
     WHERE id = $4`,
    [status, count, errorMessage ?? null, crawlId]
  );
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}
```

---

## 5. Composition Validator

The validator is the safety net between Claude's output and the Figma renderer. It must catch every possible malformed response.

```typescript
// src/composer/validator.ts

import { z } from "zod";
import {
  CompositionError,
  ComponentNotFoundError,
  InvalidVariantError,
  LLMResponseError,
} from "../lib/errors";

// ── Zod Schema for Composition JSON ────────────────────────────

const spacerNode = z.object({
  type: z.literal("spacer"),
  height: z.number().min(0).max(500).optional(),
});

const rawTextNode = z.object({
  type: z.literal("raw_text"),
  content: z.string().min(1).max(2000),
  fontSize: z.number().min(8).max(200).optional(),
  fontWeight: z.enum(["regular", "medium", "semibold", "bold"]).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6,8}$/).optional(),
  align: z.enum(["left", "center", "right"]).optional(),
  maxWidth: z.number().min(1).max(5000).optional(),
});

const instanceNode = z.object({
  type: z.literal("instance"),
  component: z.string().min(1).max(200),
  properties: z.record(z.union([z.string(), z.boolean(), z.number()])).optional(),
});

// Forward declaration for recursive types
const childNode: z.ZodType<any> = z.lazy(() =>
  z.discriminatedUnion("type", [
    instanceNode,
    rawTextNode,
    spacerNode,
    groupNode,
    gridNode,
    frameNode,
  ])
);

const groupNode = z.object({
  type: z.literal("group"),
  name: z.string().max(100).optional(),
  layout: z.enum(["horizontal", "vertical"]),
  gap: z.number().min(0).max(200).optional(),
  align: z.enum(["start", "center", "end", "stretch"]).optional(),
  justify: z.enum(["start", "center", "end", "space-between"]).optional(),
  children: z.array(childNode).min(1).max(50),
});

const gridNode = z.object({
  type: z.literal("grid"),
  columns: z.number().min(1).max(6),
  gap: z.number().min(0).max(200).optional(),
  children: z.array(childNode).min(1).max(30),
});

const frameNode = z.object({
  type: z.literal("frame"),
  name: z.string().max(100).optional(),
  width: z.number().min(1).max(5000).optional(),
  height: z.number().min(1).max(10000).optional(),
  fill: z.string().regex(/^#[0-9a-fA-F]{6,8}$/).optional(),
  cornerRadius: z.number().min(0).max(100).optional(),
  children: z.array(childNode).optional(),
});

const sectionSchema = z.object({
  name: z.string().min(1).max(100),
  layout: z.enum(["vertical", "horizontal"]).optional(),
  padding: z.union([
    z.number(),
    z.tuple([z.number(), z.number()]),
    z.tuple([z.number(), z.number(), z.number(), z.number()]),
  ]).optional(),
  gap: z.number().min(0).max(200).optional(),
  fill: z.string().regex(/^#[0-9a-fA-F]{6,8}$/).optional(),
  maxWidth: z.number().min(100).max(5000).optional(),
  align: z.enum(["start", "center", "end"]).optional(),
  children: z.array(childNode).min(1).max(100),
});

const compositionSchema = z.object({
  page: z.string().min(1).max(200),
  width: z.number().min(320).max(3840).optional(),
  sections: z.array(sectionSchema).min(1).max(30),
});

export type CompositionJSON = z.infer<typeof compositionSchema>;

// ── Validation Pipeline ─────────────────────────────────────────

interface ValidationContext {
  catalogMap: Map<string, ComponentCatalogEntry>;
}

interface ValidationResult {
  valid: boolean;
  composition?: CompositionJSON;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  resolvedKeys: Map<string, string>; // componentName → resolvedKey
}

interface ValidationError {
  path: string;
  message: string;
  code: string;
}

interface ValidationWarning {
  path: string;
  message: string;
}

export function validateComposition(
  raw: string,
  catalog: ComponentCatalogEntry[]
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const resolvedKeys = new Map<string, string>();
  const catalogMap = new Map(catalog.map(c => [c.name, c]));

  // ── Step 1: Parse JSON ──────────────────────────────────────
  let parsed: unknown;
  try {
    // Strip markdown fences (LLM sometimes wraps in ```)
    const cleaned = raw
      .replace(/^```(?:json)?\s*/m, "")
      .replace(/\s*```\s*$/m, "")
      .trim();

    parsed = JSON.parse(cleaned);
  } catch (err) {
    // ── Edge Case: LLM returned explanation instead of JSON ───
    if (raw.toLowerCase().includes("i can") || raw.toLowerCase().includes("here")) {
      errors.push({
        path: "$",
        message: "LLM returned natural language instead of JSON. Retry needed.",
        code: "NOT_JSON",
      });
    } else {
      errors.push({
        path: "$",
        message: `Invalid JSON: ${err instanceof Error ? err.message : err}`,
        code: "PARSE_ERROR",
      });
    }
    return { valid: false, errors, warnings, resolvedKeys };
  }

  // ── Step 2: Schema Validation ───────────────────────────────
  const schemaResult = compositionSchema.safeParse(parsed);
  if (!schemaResult.success) {
    for (const issue of schemaResult.error.issues) {
      errors.push({
        path: issue.path.join("."),
        message: issue.message,
        code: "SCHEMA_ERROR",
      });
    }
    return { valid: false, errors, warnings, resolvedKeys };
  }

  const composition = schemaResult.data;

  // ── Step 3: Semantic Validation ─────────────────────────────
  let instanceCount = 0;
  let maxDepth = 0;

  function walkNode(node: any, path: string, depth: number) {
    maxDepth = Math.max(maxDepth, depth);

    // ── Edge Case: Excessive nesting ────────────────────────
    if (depth > 10) {
      warnings.push({
        path,
        message: `Nesting depth ${depth} exceeds recommended maximum of 10. May cause Figma performance issues.`,
      });
    }

    if (node.type === "instance") {
      instanceCount++;
      const component = catalogMap.get(node.component);

      // ── Edge Case: Component not in catalog ─────────────
      if (!component) {
        // Try fuzzy match
        const fuzzyMatch = findFuzzyMatch(node.component, catalogMap);
        if (fuzzyMatch) {
          warnings.push({
            path: `${path}.component`,
            message: `"${node.component}" not found. Did you mean "${fuzzyMatch}"?`,
          });
          // Auto-correct
          node.component = fuzzyMatch;
          const correctedComponent = catalogMap.get(fuzzyMatch)!;
          resolvedKeys.set(fuzzyMatch, correctedComponent.key);
        } else {
          errors.push({
            path: `${path}.component`,
            message: `Component "${node.component}" not found in catalog.`,
            code: "COMPONENT_NOT_FOUND",
          });
        }
      } else {
        resolvedKeys.set(node.component, component.key);

        // Validate properties
        if (node.properties) {
          for (const [propName, propValue] of Object.entries(node.properties)) {
            const propDef = component.properties[propName];

            // ── Edge Case: Unknown property ───────────────
            if (!propDef) {
              // Try matching without #suffix
              const matchByDisplayName = Object.values(component.properties)
                .find(p => p.name === propName);

              if (matchByDisplayName) {
                // Auto-correct: use full name with suffix
                warnings.push({
                  path: `${path}.properties.${propName}`,
                  message: `Using full property name "${matchByDisplayName.fullName}" instead of "${propName}"`,
                });
                node.properties[matchByDisplayName.fullName] = propValue;
                delete node.properties[propName];
              } else {
                warnings.push({
                  path: `${path}.properties.${propName}`,
                  message: `Unknown property "${propName}" on ${node.component}. Will be ignored.`,
                });
              }
              continue;
            }

            // ── Edge Case: Invalid variant value ──────────
            if (propDef.type === "VARIANT" && propDef.options) {
              if (!propDef.options.includes(propValue as string)) {
                errors.push({
                  path: `${path}.properties.${propName}`,
                  message: `Invalid variant "${propValue}" for ${node.component}.${propDef.name}. Valid: ${propDef.options.join(", ")}`,
                  code: "INVALID_VARIANT",
                });
              }
            }

            // ── Edge Case: Wrong type for property ────────
            if (propDef.type === "BOOLEAN" && typeof propValue !== "boolean") {
              warnings.push({
                path: `${path}.properties.${propName}`,
                message: `Expected boolean for ${propName}, got ${typeof propValue}. Will coerce.`,
              });
              node.properties[propName] = Boolean(propValue);
            }

            if (propDef.type === "TEXT" && typeof propValue !== "string") {
              node.properties[propName] = String(propValue);
            }
          }
        }
      }
    }

    // Recurse
    if (node.children) {
      node.children.forEach((child: any, i: number) =>
        walkNode(child, `${path}.children[${i}]`, depth + 1)
      );
    }
  }

  composition.sections.forEach((section, i) => {
    section.children.forEach((child: any, j: number) => {
      walkNode(child, `sections[${i}].children[${j}]`, 1);
    });
  });

  // ── Edge Case: No component instances at all ────────────────
  if (instanceCount === 0) {
    warnings.push({
      path: "$",
      message: "Composition contains no component instances. Only raw layout elements.",
    });
  }

  // ── Edge Case: Too many instances (performance) ─────────────
  if (instanceCount > 100) {
    warnings.push({
      path: "$",
      message: `${instanceCount} component instances may cause Figma performance issues. Consider simplifying.`,
    });
  }

  return {
    valid: errors.length === 0,
    composition: errors.length === 0 ? composition : undefined,
    errors,
    warnings,
    resolvedKeys,
  };
}

/**
 * Fuzzy match component name: handles typos, case differences,
 * and common LLM mistakes (e.g. "button" vs "Button", "PrimaryButton" vs "Button/Primary")
 */
function findFuzzyMatch(
  name: string,
  catalogMap: Map<string, ComponentCatalogEntry>
): string | null {
  const lower = name.toLowerCase().replace(/[\s_-]/g, "");

  // Exact case-insensitive match
  for (const [catalogName] of catalogMap) {
    if (catalogName.toLowerCase().replace(/[\s_-]/g, "") === lower) {
      return catalogName;
    }
  }

  // Substring match (e.g. "PrimaryButton" → "Button")
  for (const [catalogName] of catalogMap) {
    const catalogLower = catalogName.toLowerCase().replace(/[\s_-]/g, "");
    if (lower.includes(catalogLower) || catalogLower.includes(lower)) {
      return catalogName;
    }
  }

  // Levenshtein distance ≤ 2 for short names
  if (name.length <= 15) {
    let bestMatch: string | null = null;
    let bestDistance = Infinity;

    for (const [catalogName] of catalogMap) {
      const dist = levenshtein(lower, catalogName.toLowerCase());
      if (dist < bestDistance && dist <= 2) {
        bestDistance = dist;
        bestMatch = catalogName;
      }
    }

    return bestMatch;
  }

  return null;
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}
```

---

## 6. Test Strategy

### 6.1 Test Configuration

```typescript
// vitest.config.ts

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts", "src/db/migrations/**"],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
    // Separate integration tests (need database)
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
```

### 6.2 Test Setup

```typescript
// tests/setup.ts

import { Pool } from "pg";
import { readFileSync } from "fs";
import { join } from "path";

let testPool: Pool;

beforeAll(async () => {
  // Use separate test database
  const testDbUrl = process.env.TEST_DATABASE_URL
    ?? "postgresql://test:test@localhost:5432/figma_library_test";

  testPool = new Pool({ connectionString: testDbUrl });

  // Run migrations
  const migrations = ["001_initial.sql", "002_embeddings.sql", "003_catalog_categories.sql", "004_openai_embeddings.sql"];
  for (const m of migrations) {
    const sql = readFileSync(
      join(__dirname, "../src/db/migrations", m),
      "utf-8"
    );
    await testPool.query(sql);
  }

  // Seed test project
  await testPool.query(`
    INSERT INTO projects (id, name, figma_file_key, active)
    VALUES ('test-project', 'Test Library', 'abc123filekey', true)
    ON CONFLICT (id) DO NOTHING
  `);
});

afterAll(async () => {
  if (testPool) {
    await testPool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    await testPool.end();
  }
});

export function getTestPool() {
  return testPool;
}
```

### 6.3 Unit Tests — Extractors

```typescript
// src/crawler/extractors.test.ts

import { describe, it, expect } from "vitest";
import {
  extractPropertyDefinitions,
  extractVariantCombinations,
  buildSearchText,
} from "./extractors";

describe("extractPropertyDefinitions", () => {
  it("extracts VARIANT properties with options", () => {
    const nodeData = {
      componentPropertyDefinitions: {
        Size: {
          type: "VARIANT",
          defaultValue: "Medium",
          variantOptions: ["Small", "Medium", "Large"],
        },
      },
    };

    const result = extractPropertyDefinitions(nodeData);

    expect(result.Size).toEqual({
      type: "VARIANT",
      name: "Size",
      fullName: "Size",
      defaultValue: "Medium",
      options: ["Small", "Medium", "Large"],
    });
  });

  it("extracts BOOLEAN properties with #suffix", () => {
    const nodeData = {
      componentPropertyDefinitions: {
        "IconVisible#0:0": {
          type: "BOOLEAN",
          defaultValue: false,
        },
      },
    };

    const result = extractPropertyDefinitions(nodeData);

    expect(result["IconVisible#0:0"].name).toBe("IconVisible");
    expect(result["IconVisible#0:0"].fullName).toBe("IconVisible#0:0");
    expect(result["IconVisible#0:0"].type).toBe("BOOLEAN");
  });

  it("extracts TEXT properties", () => {
    const nodeData = {
      componentPropertyDefinitions: {
        "ButtonText#0:1": {
          type: "TEXT",
          defaultValue: "Click me",
        },
      },
    };

    const result = extractPropertyDefinitions(nodeData);
    expect(result["ButtonText#0:1"].defaultValue).toBe("Click me");
  });

  it("extracts INSTANCE_SWAP with preferred values", () => {
    const nodeData = {
      componentPropertyDefinitions: {
        "Icon#0:2": {
          type: "INSTANCE_SWAP",
          defaultValue: "1:1",
          preferredValues: [
            { type: "COMPONENT", key: "abc123" },
          ],
        },
      },
    };

    const result = extractPropertyDefinitions(nodeData);
    expect(result["Icon#0:2"].preferredValues).toHaveLength(1);
  });

  // ── Edge Cases ─────────────────────────────────────────────

  it("handles node with no componentPropertyDefinitions", () => {
    const result = extractPropertyDefinitions({});
    expect(result).toEqual({});
  });

  it("handles null componentPropertyDefinitions", () => {
    const result = extractPropertyDefinitions({ componentPropertyDefinitions: null });
    expect(result).toEqual({});
  });

  it("handles empty componentPropertyDefinitions", () => {
    const result = extractPropertyDefinitions({ componentPropertyDefinitions: {} });
    expect(result).toEqual({});
  });

  it("handles property names with multiple # characters", () => {
    const nodeData = {
      componentPropertyDefinitions: {
        "Label#1:0#extra": {
          type: "TEXT",
          defaultValue: "test",
        },
      },
    };

    const result = extractPropertyDefinitions(nodeData);
    expect(result["Label#1:0#extra"].name).toBe("Label");
    expect(result["Label#1:0#extra"].fullName).toBe("Label#1:0#extra");
  });
});

describe("extractVariantCombinations", () => {
  it("parses variant name format correctly", () => {
    const components = [
      {
        name: "Size=Large, State=Default",
        key: "key1",
        containing_frame: {
          containingComponentSet: { name: "Button" },
        },
      },
      {
        name: "Size=Small, State=Hover",
        key: "key2",
        containing_frame: {
          containingComponentSet: { name: "Button" },
        },
      },
    ];

    const result = extractVariantCombinations({ name: "Button" }, components);

    expect(result).toHaveLength(2);
    expect(result[0].properties).toEqual({ Size: "Large", State: "Default" });
    expect(result[1].properties).toEqual({ Size: "Small", State: "Hover" });
  });

  // ── Edge Cases ─────────────────────────────────────────────

  it("handles single variant property", () => {
    const components = [{
      name: "Size=Large",
      key: "key1",
      containing_frame: { containingComponentSet: { name: "Icon" } },
    }];

    const result = extractVariantCombinations({ name: "Icon" }, components);
    expect(result[0].properties).toEqual({ Size: "Large" });
  });

  it("handles variant values with spaces", () => {
    const components = [{
      name: "Type=With Icon, Size=Extra Large",
      key: "key1",
      containing_frame: { containingComponentSet: { name: "Button" } },
    }];

    const result = extractVariantCombinations({ name: "Button" }, components);
    expect(result[0].properties).toEqual({
      Type: "With Icon",
      Size: "Extra Large",
    });
  });

  it("handles variant values with equals sign in value", () => {
    // Edge case: property value contains "="
    const components = [{
      name: "Label=a=b",
      key: "key1",
      containing_frame: { containingComponentSet: { name: "Tag" } },
    }];

    const result = extractVariantCombinations({ name: "Tag" }, components);
    // Should only split on first "="
    expect(result[0].properties.Label).toBeDefined();
  });

  it("returns empty array when no matching components", () => {
    const result = extractVariantCombinations(
      { name: "NonExistent" },
      [{ name: "Size=Large", key: "k", containing_frame: { containingComponentSet: { name: "Other" } } }]
    );
    expect(result).toEqual([]);
  });

  it("handles malformed variant names gracefully", () => {
    const components = [{
      name: "",
      key: "key1",
      containing_frame: { containingComponentSet: { name: "Broken" } },
    }];

    const result = extractVariantCombinations({ name: "Broken" }, components);
    expect(result).toHaveLength(1);
    expect(result[0].properties).toEqual({});
  });
});

describe("buildSearchText", () => {
  it("includes component name and description", () => {
    const text = buildSearchText("Button", "Primary action button", {}, []);
    expect(text).toContain("Button");
    expect(text).toContain("Primary action button");
  });

  it("includes variant options", () => {
    const props = {
      Size: { type: "VARIANT" as const, name: "Size", fullName: "Size", defaultValue: "Medium", options: ["Small", "Medium", "Large"] },
    };
    const text = buildSearchText("Button", "", props, []);
    expect(text).toContain("Small");
    expect(text).toContain("Large");
  });

  it("adds semantic hints for known component patterns", () => {
    const text = buildSearchText("PrimaryButton", "", {}, []);
    expect(text).toContain("action");
    expect(text).toContain("cta");
  });
});
```

### 6.4 Unit Tests — Validator

```typescript
// src/composer/validator.test.ts

import { describe, it, expect } from "vitest";
import { validateComposition } from "./validator";
import { readFileSync } from "fs";
import { join } from "path";

const mockCatalog: ComponentCatalogEntry[] = [
  {
    componentType: "component_set",
    name: "Button",
    key: "btn-key-123",
    nodeId: "1:1",
    fileKey: "file1",
    description: "Action button",
    properties: {
      Size: { type: "VARIANT", name: "Size", fullName: "Size", defaultValue: "Medium", options: ["Small", "Medium", "Large"] },
      "ButtonText#0:1": { type: "TEXT", name: "ButtonText", fullName: "ButtonText#0:1", defaultValue: "Click" },
      "IconVisible#0:0": { type: "BOOLEAN", name: "IconVisible", fullName: "IconVisible#0:0", defaultValue: false },
    },
    variants: [
      { name: "Size=Small", key: "btn-small", properties: { Size: "Small" } },
      { name: "Size=Medium", key: "btn-medium", properties: { Size: "Medium" } },
      { name: "Size=Large", key: "btn-large", properties: { Size: "Large" } },
    ],
    variantCount: 3,
    searchText: "Button action",
  },
  {
    componentType: "component",
    name: "Divider",
    key: "div-key-456",
    nodeId: "2:1",
    fileKey: "file1",
    description: "Horizontal divider",
    properties: {},
    variants: [],
    variantCount: 0,
    searchText: "Divider line",
  },
];

describe("validateComposition", () => {
  // ── Happy Path ──────────────────────────────────────────────

  it("validates a correct minimal composition", () => {
    const json = JSON.stringify({
      page: "Test Page",
      width: 1440,
      sections: [{
        name: "Hero",
        children: [{
          type: "instance",
          component: "Button",
          properties: { Size: "Large", "ButtonText#0:1": "Click me" },
        }],
      }],
    });

    const result = validateComposition(json, mockCatalog);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.resolvedKeys.get("Button")).toBe("btn-key-123");
  });

  it("validates composition with mixed node types", () => {
    const json = JSON.stringify({
      page: "Mixed",
      sections: [{
        name: "Content",
        children: [
          { type: "raw_text", content: "Hello", fontSize: 24, fontWeight: "bold" },
          { type: "instance", component: "Divider" },
          { type: "spacer", height: 32 },
          { type: "group", layout: "horizontal", gap: 16, children: [
            { type: "instance", component: "Button", properties: { Size: "Small" } },
            { type: "instance", component: "Button", properties: { Size: "Medium" } },
          ]},
        ],
      }],
    });

    const result = validateComposition(json, mockCatalog);
    expect(result.valid).toBe(true);
  });

  // ── JSON Parsing Edge Cases ─────────────────────────────────

  it("strips markdown code fences", () => {
    const json = '```json\n{"page":"Test","sections":[{"name":"A","children":[{"type":"spacer"}]}]}\n```';
    const result = validateComposition(json, mockCatalog);
    expect(result.valid).toBe(true);
  });

  it("handles plain code fences without language tag", () => {
    const json = '```\n{"page":"Test","sections":[{"name":"A","children":[{"type":"spacer"}]}]}\n```';
    const result = validateComposition(json, mockCatalog);
    expect(result.valid).toBe(true);
  });

  it("rejects natural language response from LLM", () => {
    const result = validateComposition(
      "I can help you create a landing page. Here's what I suggest...",
      mockCatalog
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe("NOT_JSON");
  });

  it("rejects truncated JSON (incomplete LLM response)", () => {
    const result = validateComposition(
      '{"page":"Test","sections":[{"name":"Hero","children":[{"type":"instance","compo',
      mockCatalog
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe("PARSE_ERROR");
  });

  it("rejects empty string", () => {
    const result = validateComposition("", mockCatalog);
    expect(result.valid).toBe(false);
  });

  it("rejects valid JSON but wrong structure", () => {
    const result = validateComposition('{"hello":"world"}', mockCatalog);
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe("SCHEMA_ERROR");
  });

  // ── Component Reference Edge Cases ──────────────────────────

  it("rejects reference to non-existent component", () => {
    const json = JSON.stringify({
      page: "Test",
      sections: [{ name: "S", children: [
        { type: "instance", component: "NonExistentWidget" },
      ]}],
    });

    const result = validateComposition(json, mockCatalog);
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe("COMPONENT_NOT_FOUND");
  });

  it("fuzzy-matches component name with wrong case", () => {
    const json = JSON.stringify({
      page: "Test",
      sections: [{ name: "S", children: [
        { type: "instance", component: "button" }, // lowercase
      ]}],
    });

    const result = validateComposition(json, mockCatalog);
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0].message).toContain("Did you mean");
  });

  it("fuzzy-matches component name with typo", () => {
    const json = JSON.stringify({
      page: "Test",
      sections: [{ name: "S", children: [
        { type: "instance", component: "Buttn" }, // typo
      ]}],
    });

    const result = validateComposition(json, mockCatalog);
    // Should find fuzzy match within Levenshtein distance 2
    expect(result.warnings.some(w => w.message.includes("Did you mean"))).toBe(true);
  });

  // ── Property Validation Edge Cases ──────────────────────────

  it("rejects invalid variant value", () => {
    const json = JSON.stringify({
      page: "Test",
      sections: [{ name: "S", children: [
        { type: "instance", component: "Button", properties: { Size: "Huge" } },
      ]}],
    });

    const result = validateComposition(json, mockCatalog);
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe("INVALID_VARIANT");
    expect(result.errors[0].message).toContain("Huge");
    expect(result.errors[0].message).toContain("Small, Medium, Large");
  });

  it("auto-corrects property name without #suffix", () => {
    const json = JSON.stringify({
      page: "Test",
      sections: [{ name: "S", children: [
        { type: "instance", component: "Button", properties: { ButtonText: "Hello" } },
      ]}],
    });

    const result = validateComposition(json, mockCatalog);
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.message.includes("ButtonText#0:1"))).toBe(true);
  });

  it("coerces string to boolean for BOOLEAN property", () => {
    const json = JSON.stringify({
      page: "Test",
      sections: [{ name: "S", children: [
        { type: "instance", component: "Button", properties: { "IconVisible#0:0": "true" } },
      ]}],
    });

    const result = validateComposition(json, mockCatalog);
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.message.includes("boolean"))).toBe(true);
  });

  it("warns on unknown property", () => {
    const json = JSON.stringify({
      page: "Test",
      sections: [{ name: "S", children: [
        { type: "instance", component: "Button", properties: { Color: "red" } },
      ]}],
    });

    const result = validateComposition(json, mockCatalog);
    expect(result.valid).toBe(true); // Unknown props are warnings, not errors
    expect(result.warnings.some(w => w.message.includes("Unknown property"))).toBe(true);
  });

  // ── Structural Edge Cases ───────────────────────────────────

  it("warns on deeply nested composition", () => {
    // Build 12 levels of nesting
    let innermost: any = { type: "instance", component: "Button", properties: { Size: "Small" } };
    for (let i = 0; i < 12; i++) {
      innermost = { type: "group", layout: "vertical", children: [innermost] };
    }

    const json = JSON.stringify({
      page: "Deep",
      sections: [{ name: "S", children: [innermost] }],
    });

    const result = validateComposition(json, mockCatalog);
    expect(result.valid).toBe(true); // Deep nesting is a warning, not error
    expect(result.warnings.some(w => w.message.includes("nesting depth"))).toBe(true);
  });

  it("warns when no component instances exist", () => {
    const json = JSON.stringify({
      page: "Empty",
      sections: [{ name: "S", children: [
        { type: "raw_text", content: "Just text" },
        { type: "spacer", height: 20 },
      ]}],
    });

    const result = validateComposition(json, mockCatalog);
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.message.includes("no component instances"))).toBe(true);
  });

  it("warns on excessive instance count", () => {
    const children = Array.from({ length: 101 }, () => ({
      type: "instance",
      component: "Divider",
    }));

    // Need to split across sections to stay under per-section limit
    const sections = [];
    for (let i = 0; i < children.length; i += 50) {
      sections.push({
        name: `Section ${Math.floor(i / 50)}`,
        children: children.slice(i, i + 50),
      });
    }

    const json = JSON.stringify({ page: "Many", sections });
    const result = validateComposition(json, mockCatalog);
    expect(result.warnings.some(w => w.message.includes("performance"))).toBe(true);
  });

  // ── Schema Boundary Tests ───────────────────────────────────

  it("rejects page width below 320", () => {
    const json = JSON.stringify({
      page: "Tiny",
      width: 100,
      sections: [{ name: "S", children: [{ type: "spacer" }] }],
    });

    const result = validateComposition(json, mockCatalog);
    expect(result.valid).toBe(false);
  });

  it("rejects page width above 3840", () => {
    const json = JSON.stringify({
      page: "Huge",
      width: 5000,
      sections: [{ name: "S", children: [{ type: "spacer" }] }],
    });

    const result = validateComposition(json, mockCatalog);
    expect(result.valid).toBe(false);
  });

  it("rejects section with empty children", () => {
    const json = JSON.stringify({
      page: "Empty",
      sections: [{ name: "S", children: [] }],
    });

    const result = validateComposition(json, mockCatalog);
    expect(result.valid).toBe(false);
  });

  it("rejects color values with wrong format", () => {
    const json = JSON.stringify({
      page: "Bad Color",
      sections: [{ name: "S", fill: "red", children: [{ type: "spacer" }] }],
    });

    const result = validateComposition(json, mockCatalog);
    expect(result.valid).toBe(false);
  });

  it("accepts 8-character hex colors (with alpha)", () => {
    const json = JSON.stringify({
      page: "Alpha",
      sections: [{ name: "S", fill: "#FF000080", children: [{ type: "spacer" }] }],
    });

    const result = validateComposition(json, mockCatalog);
    expect(result.valid).toBe(true);
  });
});
```

### 6.5 Integration Tests — Compose Flow

```typescript
// tests/integration/compose.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest";
import { compose } from "../../src/composer/compose";

// Mock Claude API
vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = {
      create: vi.fn(),
    };
  },
}));

// Mock RAG retrieval
vi.mock("../../src/rag/retrieval", () => ({
  smartRetrieve: vi.fn(),
}));

import Anthropic from "@anthropic-ai/sdk";
import { smartRetrieve } from "../../src/rag/retrieval";

const mockCatalog = [
  {
    name: "Button",
    key: "btn-key",
    componentType: "component_set",
    properties: {
      Size: { type: "VARIANT", name: "Size", fullName: "Size", defaultValue: "Medium", options: ["Small", "Medium", "Large"] },
    },
    variants: [
      { name: "Size=Large", key: "btn-large", properties: { Size: "Large" } },
    ],
    usageHint: "Use for CTAs",
    commonContexts: ["hero", "footer"],
    similarity: 0.95,
  },
];

describe("compose", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (smartRetrieve as any).mockResolvedValue(mockCatalog);
  });

  it("returns valid composition for simple prompt", async () => {
    const mockResponse = {
      content: [{ type: "text", text: JSON.stringify({
        page: "Landing",
        sections: [{ name: "Hero", children: [
          { type: "instance", component: "Button", properties: { Size: "Large" } },
        ]}],
      })}],
      usage: { input_tokens: 500, output_tokens: 200 },
    };

    const anthropic = new Anthropic({ apiKey: "test" });
    (anthropic.messages.create as any).mockResolvedValue(mockResponse);

    const result = await compose({
      prompt: "Create a landing page",
      projectId: "test-project",
    });

    expect(result.composition.page).toBe("Landing");
    expect(result.componentsUsed).toHaveLength(1);
    expect(result.tokensUsed).toBe(700);
  });

  it("retries on malformed LLM response", async () => {
    const anthropic = new Anthropic({ apiKey: "test" });

    // First call returns bad JSON, second returns valid
    (anthropic.messages.create as any)
      .mockResolvedValueOnce({
        content: [{ type: "text", text: "I'd be happy to help! Here's a design:" }],
        usage: { input_tokens: 500, output_tokens: 50 },
      })
      .mockResolvedValueOnce({
        content: [{ type: "text", text: JSON.stringify({
          page: "Landing",
          sections: [{ name: "Hero", children: [{ type: "spacer" }] }],
        })}],
        usage: { input_tokens: 600, output_tokens: 200 },
      });

    // Should succeed on retry
    const result = await compose({
      prompt: "Create a landing page",
      projectId: "test-project",
    });

    expect(result.composition).toBeDefined();
    expect(anthropic.messages.create).toHaveBeenCalledTimes(2);
  });

  it("throws after max retries on persistent LLM failure", async () => {
    const anthropic = new Anthropic({ apiKey: "test" });

    (anthropic.messages.create as any).mockResolvedValue({
      content: [{ type: "text", text: "Sorry, I cannot generate JSON right now." }],
      usage: { input_tokens: 500, output_tokens: 30 },
    });

    await expect(
      compose({ prompt: "Create a page", projectId: "test-project" })
    ).rejects.toThrow("LLM_RESPONSE_ERROR");
  });

  it("handles empty RAG results gracefully", async () => {
    (smartRetrieve as any).mockResolvedValue([]);

    await expect(
      compose({ prompt: "Create a page", projectId: "test-project" })
    ).rejects.toThrow("No components found");
  });
});
```

### 6.6 Integration Tests — RAG Retrieval

```typescript
// tests/integration/rag.test.ts

import { describe, it, expect, beforeAll } from "vitest";
import { getTestPool } from "../setup";
import { generateEmbeddings } from "../../src/rag/embeddings";
import { retrieveComponents } from "../../src/rag/retrieval";

describe("RAG Pipeline", () => {
  beforeAll(async () => {
    const db = getTestPool();

    // Insert test catalog entries
    const entries = [
      { name: "Button", searchText: "Button action click cta submit", key: "btn-1" },
      { name: "Card", searchText: "Card content container teaser tile", key: "card-1" },
      { name: "InputField", searchText: "Input text field form user data entry", key: "input-1" },
      { name: "NavBar", searchText: "Navigation menu header links top bar", key: "nav-1" },
      { name: "HeroSection", searchText: "Hero banner headline above fold landing", key: "hero-1" },
    ];

    for (const e of entries) {
      await db.query(
        `INSERT INTO component_catalog (project_id, component_type, name, key, node_id, file_key, search_text, active)
         VALUES ('test-project', 'component', $1, $2, '1:1', 'file1', $3, true)
         ON CONFLICT (project_id, key) DO NOTHING`,
        [e.name, e.key, e.searchText]
      );
    }

    // Generate embeddings
    await generateEmbeddings(db, "test-project", entries.map(e => ({
      ...e,
      componentType: "component" as const,
      nodeId: "1:1",
      fileKey: "file1",
      description: "",
      properties: {},
      variants: [],
      variantCount: 0,
    })));
  });

  it("retrieves semantically relevant components", async () => {
    const db = getTestPool();
    const results = await retrieveComponents(
      db, "test-project", "I need a call to action button", 5
    );

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe("Button");
  });

  it("retrieves navigation components for menu query", async () => {
    const db = getTestPool();
    const results = await retrieveComponents(
      db, "test-project", "navigation menu header", 5
    );

    expect(results.some(r => r.name === "NavBar")).toBe(true);
  });

  it("returns empty array for completely unrelated query", async () => {
    const db = getTestPool();
    const results = await retrieveComponents(
      db, "test-project", "quantum physics dark matter", 5
    );

    // Should still return results (just low relevance), not crash
    expect(Array.isArray(results)).toBe(true);
  });
});
```

---

## 7. Edge Cases — Complete Reference

### 7.1 Figma API Edge Cases

| Edge Case | Impact | Handling |
|-----------|--------|----------|
| **PAT expired** | All API calls return 403 | `FigmaAuthError` → surface to user with rotation instructions |
| **PAT approaching expiry** | None yet | Config check on startup warns 7 days before expiry |
| **Rate limit hit (429)** | Request blocked, long Retry-After | Exponential backoff with `Retry-After` header respect |
| **Rate limit: `low` tier despite paid plan** | Known Figma bug (Nov 2025+) | Log warning, retry with longer backoff, surface to user if persistent |
| **Library file deleted/moved** | 404 on component fetch | `FigmaNotFoundError` → mark project as inactive, notify |
| **Library partially published** | Some components return empty | Continue with partial data, log warnings per component |
| **Component unpublished between crawl and compose** | `importComponentByKeyAsync` rejects | Try/catch per instance in renderer, skip failed, report to user |
| **Very large library (1000+ components)** | Slow crawl, many API calls | Batch in groups of 30, respect rate limits, allow partial crawl |
| **File in wrong Figma plan** | Starter plan = 6 requests/month | Check plan tier on first request, warn user immediately |
| **Network timeout during crawl** | AbortController fires | Retry with backoff, mark crawl as partial if too many failures |

### 7.2 LLM Response Edge Cases

| Edge Case | Detection | Handling |
|-----------|-----------|----------|
| **Returns natural language instead of JSON** | Parse error + heuristic (contains "I can", "here's") | Auto-retry with stronger prompt ("respond ONLY with JSON") |
| **Truncated JSON (max_tokens hit)** | JSON parse error on incomplete object | Retry with increased max_tokens (4096 → 8192) |
| **JSON wrapped in markdown fences** | Starts with `` ``` `` | Strip fences before parsing |
| **Invents component names not in catalog** | Validator: `COMPONENT_NOT_FOUND` | Fuzzy match → auto-correct if close, error if no match |
| **Uses display name instead of full property name** | Validator: unknown property | Auto-map "ButtonText" → "ButtonText#0:1" via display name lookup |
| **Uses invalid variant value** | Validator: `INVALID_VARIANT` | Error with valid options listed, retry with correction hint |
| **Sets wrong type for property** | Validator: type mismatch | Coerce where safe (string→boolean), warn |
| **Returns empty sections array** | Zod: `min(1)` | Schema validation error, retry |
| **Excessive nesting (>10 levels)** | Walk counter | Warning (not error), render anyway |
| **100+ component instances** | Walk counter | Warning about Figma performance |
| **Mixes German and English in content** | N/A | Acceptable, project language context in prompt |
| **Hallucinates properties that don't exist** | Validator: unknown property | Warning, property silently ignored in renderer |
| **Returns same component 50 times in a grid** | Valid but suspicious | No special handling (could be intentional, e.g. placeholder grid) |

### 7.3 RAG Retrieval Edge Cases

| Edge Case | Impact | Handling |
|-----------|--------|----------|
| **No components match the prompt** | Empty retrieval | Return top-N by general relevance, warn user catalog may not match |
| **Prompt is in German, catalog in English** | Low semantic similarity | `buildSearchText` includes both languages; embedding model handles multilingual |
| **Prompt is very vague ("make something nice")** | Poor component selection | `searchAnalyzer` defaults to common page-type components |
| **Prompt references a brand** | Need brand-specific tokens | Load project `default_tokens`, inject into system prompt |
| **Library has duplicate component names** | Ambiguous resolution | Use most recently crawled, warn in validator |
| **Library only has 3 components** | Very limited palette | All components fit in context, no RAG filtering needed |
| **Embedding service is down** | Cannot generate query embedding | Fallback to keyword-only search (ILIKE) |
| **Component description is empty** | Poor embedding quality | `buildSearchText` adds semantic hints based on name patterns |

### 7.4 Figma Plugin Renderer Edge Cases

| Edge Case | Impact | Handling |
|-----------|--------|----------|
| **Font not available in Figma** | `loadFontAsync` rejects | Fallback chain: Inter → Roboto → system default |
| **Component was unpublished after composition** | `importComponentByKeyAsync` rejects | Skip instance, render placeholder frame with error name |
| **Component variant no longer exists** | No matching variant child | Fall back to `defaultVariant` of component set |
| **Composition references component from wrong file** | Import fails | Validate `fileKey` matches project config before import |
| **User's Figma is on Free plan** | Library imports may be restricted | Surface clear error: "This feature requires a paid Figma plan" |
| **Canvas already has content at target position** | New design overlaps existing | Calculate bounding box of existing content, offset new design |
| **Very long text content in TEXT property** | Overflows component bounds | Let Figma handle overflow (component auto-resize settings) |
| **Plugin sandbox timeout** | Complex render takes too long | Yield between sections (`figma.commitUndo()`), progress callback |
| **Multiple rapid compose requests** | Race conditions in rendering | Queue requests, only process latest, cancel in-flight |

### 7.5 Infrastructure Edge Cases

| Edge Case | Impact | Handling |
|-----------|--------|----------|
| **Coolify deploy during active crawl** | Crawl interrupted | Crawl status stays "running" → health check detects stale crawls, marks as failed |
| **PostgreSQL connection pool exhausted** | Requests hang | Pool max size = 20, idle timeout = 30s, queue requests with timeout |
| **Anthropic API rate limit** | 429 from Claude | Retry with exponential backoff, max 3 retries |
| **Anthropic API outage** | 500/503 errors | Return user-friendly error, suggest retry in 5 minutes |
| **OpenAI embedding service down** | Cannot generate embeddings | Graceful degradation to keyword-only search |
| **Disk full on Hetzner** | Database writes fail | Monitor disk usage, alert at 80%, auto-cleanup old crawl logs |
| **Concurrent crawls on same project** | Duplicate data, race conditions | Mutex via PostgreSQL advisory lock per project |

---

## 8. Database Schema (Updated)

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE projects (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  figma_file_key  TEXT NOT NULL,
  figma_team_id   TEXT,
  description     TEXT,
  default_tokens  JSONB DEFAULT '{}',
  active          BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE component_catalog (
  id              SERIAL PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  component_type  TEXT NOT NULL CHECK (component_type IN ('component', 'component_set')),
  name            TEXT NOT NULL,
  key             TEXT NOT NULL,
  node_id         TEXT NOT NULL,
  file_key        TEXT NOT NULL,
  description     TEXT DEFAULT '',
  properties      JSONB DEFAULT '{}',
  variants        JSONB DEFAULT '[]',
  variant_count   INTEGER DEFAULT 0,
  thumbnail_url   TEXT,
  usage_hint      TEXT,
  common_contexts TEXT[] DEFAULT '{}',
  default_variant TEXT,
  search_text     TEXT NOT NULL,
  active          BOOLEAN DEFAULT true,
  crawled_at      TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(project_id, key)
);

CREATE INDEX idx_catalog_project_active ON component_catalog(project_id) WHERE active = true;
CREATE INDEX idx_catalog_name ON component_catalog(name);

CREATE TABLE component_embeddings (
  id              SERIAL PRIMARY KEY,
  catalog_id      INTEGER NOT NULL REFERENCES component_catalog(id) ON DELETE CASCADE,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  embedding       vector(1536),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_embeddings_vector ON component_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE TABLE crawl_logs (
  id              SERIAL PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status          TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  component_count INTEGER DEFAULT 0,
  error_message   TEXT,
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

-- Auto-cleanup: keep only last 50 crawl logs per project
CREATE OR REPLACE FUNCTION cleanup_crawl_logs() RETURNS trigger AS $$
BEGIN
  DELETE FROM crawl_logs
  WHERE project_id = NEW.project_id
    AND id NOT IN (
      SELECT id FROM crawl_logs
      WHERE project_id = NEW.project_id
      ORDER BY started_at DESC
      LIMIT 50
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cleanup_crawl_logs
  AFTER INSERT ON crawl_logs
  FOR EACH ROW EXECUTE FUNCTION cleanup_crawl_logs();

CREATE TABLE compositions (
  id              SERIAL PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_prompt     TEXT NOT NULL,
  composition_json JSONB NOT NULL,
  model_used      TEXT DEFAULT 'claude-sonnet-4-20250514',
  tokens_used     INTEGER,
  valid           BOOLEAN DEFAULT true,
  errors          JSONB DEFAULT '[]',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Advisory lock helper for preventing concurrent crawls
-- Usage: SELECT pg_try_advisory_lock(hashtext('crawl:' || project_id))
```

---

## 9. Deployment (Coolify)

### docker-compose.yml

```yaml
services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://audion:${DB_PASSWORD}@db:5432/audion
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - FIGMA_PAT=${FIGMA_PAT}
      - FIGMA_PAT_EXPIRES=${FIGMA_PAT_EXPIRES}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - PLUGIN_API_SECRET=${PLUGIN_API_SECRET}
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/api/v1/health"]
      interval: 30s
      timeout: 5s
      retries: 3

  db:
    image: pgvector/pgvector:pg16
    restart: unless-stopped
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=audion
      - POSTGRES_USER=audion
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U audion"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
```

### Dockerfile

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

---

## 10. Implementation Phases

### Phase 1 — Backend Foundation (Week 1)
- [ ] Project scaffold: Express, TypeScript, Vitest, Zod
- [ ] Config validation with env schema
- [ ] PostgreSQL + pgvector Docker setup
- [ ] Database migrations
- [ ] Health endpoint
- [ ] Error handling middleware + custom error classes
- [ ] **Tests**: Config validation, error classes, retry utility

### Phase 2 — Figma Crawler (Week 2)
- [ ] FigmaClient with rate limiting + retry
- [ ] Crawl pipeline: fetch → extract → store
- [ ] Property extractor (VARIANT, BOOLEAN, TEXT, INSTANCE_SWAP)
- [ ] Variant combination mapper
- [ ] Catalog upsert with soft-delete
- [ ] CLI script for manual crawl
- [ ] **Tests**: Extractor unit tests, crawl pipeline with mocked Figma API

### Phase 3 — RAG Pipeline (Week 3)
- [x] OpenAI text-embedding-3-small integration
- [ ] Embedding generation on crawl completion
- [ ] pgvector semantic search
- [ ] Keyword fallback search
- [ ] Hybrid merge + deduplication
- [ ] Search analyzer (prompt → component needs)
- [ ] **Tests**: Embedding roundtrip, retrieval relevance, fallback behavior

### Phase 4 — Composition Engine (Week 4)
- [ ] Claude API integration
- [ ] System prompt builder with catalog formatting
- [ ] Composition Zod schema
- [ ] Validator: JSON parse → schema → semantic checks
- [ ] Fuzzy component matching + auto-correction
- [ ] Property validation + coercion
- [ ] LLM retry logic (natural language, truncation)
- [ ] **Tests**: Validator unit tests (all edge cases), compose integration

### Phase 5 — Figma Plugin (Week 5-6)
- [ ] Plugin scaffold (manifest, esbuild, UI iframe)
- [ ] Backend API client
- [ ] Instance renderer (importComponentByKeyAsync → setProperties)
- [ ] Layout renderer (sections, groups, grids)
- [ ] Raw text fallback renderer
- [ ] Font loading with fallback chain
- [ ] Chat UI (audion interface)
- [ ] **Tests**: Renderer logic unit tests (mocked Figma API)

### Phase 6 — Integration & Hardening (Week 6-7)
- [ ] End-to-end flow: prompt → RAG → Claude → validate → render
- [ ] Iteration: read selection → modify composition
- [ ] node-cron scheduled re-crawl
- [ ] Coolify deployment
- [ ] CORS + plugin auth
- [ ] Concurrent crawl prevention (advisory locks)
- [ ] **Tests**: E2E smoke tests, concurrent access tests

### Phase 7 — Polish (Week 7-8)
- [ ] LLM enrichment pipeline (usage hints)
- [ ] Component browser in plugin UI
- [ ] Project selector
- [ ] Composition history
- [ ] Brand token presets
- [ ] Error UX in plugin (clear messages, retry buttons)
- [ ] Monitoring: crawl success rate, compose latency, LLM retry rate