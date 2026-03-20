import { z } from "zod";

/** Bump when breaking IR changes (CREATION + site-preview must align). */
export const PAGE_SPEC_VERSION = 1 as const;

/** Allowed block `type` strings — use in LLM system prompts. */
export const PAGE_BLOCK_TYPES = [
  "hero",
  "featureGrid",
  "cta",
  "footer",
  "logoStrip",
  "testimonial",
  "richText",
  "cardGrid",
] as const;

export type PageBlockType = (typeof PAGE_BLOCK_TYPES)[number];

const textAlignSchema = z.enum(["left", "center", "right"]).optional();

const baseBlock = z.object({
  id: z.string().min(1).optional(),
  variant: z.string().min(1).max(80).optional(),
  density: z.enum(["compact", "comfortable", "spacious"]).optional(),
  themeIntent: z.string().min(1).max(80).optional(),
  componentHints: z.array(z.string().min(1).max(120)).max(10).optional(),
});

const heroBlock = baseBlock.extend({
  type: z.literal("hero"),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  primaryCta: z
    .object({
      label: z.string().min(1),
      href: z.string().optional(),
    })
    .optional(),
  secondaryCta: z
    .object({
      label: z.string().min(1),
      href: z.string().optional(),
    })
    .optional(),
  imageUrl: z.string().url().optional(),
  align: textAlignSchema,
});

const featureItem = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  icon: z.enum(["star", "zap", "shield", "layout"]).optional(),
});

const featureGridBlock = baseBlock.extend({
  type: z.literal("featureGrid"),
  heading: z.string().optional(),
  columns: z.number().int().min(2).max(4).default(3),
  items: z.array(featureItem).min(1).max(12),
});

const ctaBlock = baseBlock.extend({
  type: z.literal("cta"),
  title: z.string().min(1),
  description: z.string().optional(),
  buttonLabel: z.string().min(1),
  href: z.string().optional(),
  variant: z.enum(["default", "muted"]).optional(),
});

const footerLink = z.object({
  label: z.string().min(1),
  href: z.string().optional(),
});

const footerBlock = baseBlock.extend({
  type: z.literal("footer"),
  brand: z.string().min(1),
  tagline: z.string().optional(),
  columns: z
    .array(
      z.object({
        heading: z.string().min(1),
        links: z.array(footerLink).max(12),
      })
    )
    .max(4)
    .optional(),
  legal: z.string().optional(),
});

const logoStripBlock = baseBlock.extend({
  type: z.literal("logoStrip"),
  heading: z.string().optional(),
  /** Label text only (no external URLs required for v1). */
  labels: z.array(z.string().min(1)).min(1).max(8),
});

const testimonialBlock = baseBlock.extend({
  type: z.literal("testimonial"),
  quote: z.string().min(1),
  author: z.string().min(1),
  role: z.string().optional(),
});

const richTextBlock = baseBlock.extend({
  type: z.literal("richText"),
  /** Plain paragraphs only (no HTML) — Figma-safe. */
  paragraphs: z.array(z.string()).min(1).max(20),
  heading: z.string().optional(),
});

const cardGridItem = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
  ctaLabel: z.string().optional(),
});

const cardGridBlock = baseBlock.extend({
  type: z.literal("cardGrid"),
  heading: z.string().optional(),
  columns: z.number().int().min(2).max(4).default(3),
  items: z.array(cardGridItem).min(1).max(12),
});

export const pageBlockSchema = z.discriminatedUnion("type", [
  heroBlock,
  featureGridBlock,
  ctaBlock,
  footerBlock,
  logoStripBlock,
  testimonialBlock,
  richTextBlock,
  cardGridBlock,
]);

export type PageBlock = z.infer<typeof pageBlockSchema>;

export const pageSpecSchema = z.object({
  version: z.literal(PAGE_SPEC_VERSION).optional().default(PAGE_SPEC_VERSION),
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  render: z
    .object({
      componentLibrary: z.enum(["default", "porsche"]).optional(),
      renderMode: z.enum(["production", "experimental", "free"]).optional(),
      stylePreset: z.string().min(1).max(80).optional(),
    })
    .optional(),
  /** Brand tokens (P4); optional in v1. */
  brand: z
    .object({
      primaryHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      accentHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    })
    .optional(),
  blocks: z.array(pageBlockSchema).min(1).max(40),
});

export type PageSpec = z.infer<typeof pageSpecSchema>;

export function parsePageSpec(input: unknown): PageSpec {
  return pageSpecSchema.parse(input);
}

export function safeParsePageSpec(input: unknown) {
  return pageSpecSchema.safeParse(input);
}

export { PAGE_SPEC_LLM_REGISTRY_DOC } from "./llm-registry.js";
