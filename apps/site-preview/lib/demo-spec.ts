import type { PageSpec } from "@audion/page-spec";

/** Static demo for `/p/demo` — no job API required. */
export const DEMO_PAGE_SPEC: PageSpec = {
  version: 1,
  title: "Audion Site Preview Demo",
  description: "shadcn blocks for html-to-figma capture",
  blocks: [
    {
      type: "hero",
      title: "Build layouts that survive Figma import",
      subtitle: "Flex, overlays, and posters — tuned for capture-page.",
      primaryCta: { label: "Get started", href: "#" },
      secondaryCta: { label: "View docs", href: "#" },
      imageUrl: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200",
    },
    {
      type: "featureGrid",
      heading: "Why PageSpec",
      columns: 3,
      items: [
        { title: "Safe IR", description: "Zod-validated blocks only.", icon: "shield" },
        { title: "shadcn UI", description: "Consistent components.", icon: "layout" },
        { title: "Capture ready", description: 'data-capture-ready marker.', icon: "zap" },
      ],
    },
    {
      type: "cardGrid",
      heading: "Cards",
      columns: 3,
      items: [
        {
          title: "Marketing hero",
          description: "Full-bleed media + overlay copy.",
          imageUrl: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800",
          ctaLabel: "Open",
        },
        {
          title: "Feature row",
          description: "Side-by-side icons and text.",
          ctaLabel: "Details",
        },
        {
          title: "CTA band",
          description: "Dense conversion strip.",
          ctaLabel: "Contact",
        },
      ],
    },
    {
      type: "cta",
      title: "Ship previews to Figma",
      description: "One URL for Puppeteer and the plugin pipeline.",
      buttonLabel: "Try capture",
      variant: "default",
    },
    {
      type: "testimonial",
      quote: "The PageSpec mapper keeps our LLM from inventing new CSS.",
      author: "Design Systems",
      role: "Platform",
    },
    {
      type: "logoStrip",
      heading: "Trusted by teams",
      labels: ["ALPHA", "BRAVO", "CHARLIE", "DELTA"],
    },
    {
      type: "richText",
      heading: "Editorial",
      paragraphs: [
        "Plain text paragraphs only — no HTML injection surface.",
        "Second paragraph for multi-block flow.",
      ],
    },
    {
      type: "footer",
      brand: "Site Preview",
      tagline: "Prompt → shadcn → Figma",
      columns: [
        {
          heading: "Product",
          links: [
            { label: "Capture", href: "#" },
            { label: "Blocks", href: "#" },
          ],
        },
      ],
      legal: "© Demo",
    },
  ],
};
