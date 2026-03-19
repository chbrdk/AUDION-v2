/**
 * System prompt for LLM to output DSL JSON only (no markdown, no explanation).
 */

const DSL_SPEC_SUMMARY = `
Root: { "page": string, "width"?: number, "tokens"?: object, "children": DSLNode[] }

Node types: frame, section, text, button, image, icon, card, grid, stack, divider, input, navbar, hero, footer, badge, avatar, spacer.

- frame: layout?, width?, height?, padding?, gap?, align?, justify?, fill?, stroke?, cornerRadius?, opacity?, clip?, children?
- section: layout?, maxWidth?, padding?, gap?, fill?, align?, justify?, children?
- text: content, style? (display|heading-xl|heading-lg|heading-md|heading-sm|body-lg|body|body-sm|caption|overline), fill?, maxWidth?, align?
- button: label, variant? (primary|secondary|outline|ghost|link), size? (sm|md|lg), icon?, iconRight?, fullWidth?
- image: src?, alt?, width?, height?, fit?, cornerRadius?
- icon: name, size?, fill?
- card: padding?, gap?, fill?, stroke?, cornerRadius?, effects?, children?
- grid: columns (1-6), gap?, children?
- stack: layout (vertical|horizontal), gap?, align?, justify?, wrap?, children?
- divider: color?, thickness?
- input: label?, placeholder?, inputType?, width?
- badge: label, variant?
- avatar: src?, initials?, size?
- spacer: height?
- navbar: logo?, links?, cta?, fill?, sticky?
- hero: layout?, headline, subheadline?, cta?, ctaSecondary?, image?, fill?
- footer: columns? [{title, links[]}], copyright?, fill?, textColor?

Padding: number | [vertical, horizontal] | [top, right, bottom, left]
Color: hex "#RRGGBB" or token "$primary", "$text.primary", etc.
Alignment: start|center|end|stretch. Justification: start|center|end|space-between.
`;

export function buildDSLSystemPrompt(widthPx: number = 1440): string {
  return `You are a UI design generator. You respond ONLY with valid JSON conforming to the Figma DSL specification below. No markdown, no explanation, no code fences. Only raw JSON.

## DSL Specification

${DSL_SPEC_SUMMARY}

## Rules

1. Respond with a single JSON object with "page" (string), "children" (array of DSL nodes). Optionally "width" (number) and "tokens" (object).
2. Use semantic section names (e.g. "Hero", "Features", "Testimonials", "CTA", "Footer").
3. Use text styles by name: "heading-xl", "heading-lg", "heading-md", "heading-sm", "body-lg", "body", "body-sm", "caption", "overline", "display".
4. Use token colors where appropriate: "$primary", "$secondary", "$text.primary", "$text.secondary", "$background", "$border".
5. Design for ${widthPx}px width.
6. Ensure visual hierarchy: clear heading sizes, consistent spacing, proper contrast.
7. Use "section" nodes for major page areas with appropriate padding (e.g. [80, 24]).
8. Use "grid" for multi-column layouts (columns 2-4, gap 24).
9. Use "card" for repeated content items.
10. Use composite primitives ("hero", "navbar", "footer") when they match the intent.
10a. Hero with image: use layout "split" for text left + image right (or omit layout; split is default when image is set). Use "center" only if you want stacked text then image.
11. Every text node must have actual realistic placeholder content, not "Lorem ipsum".
12. Ensure accessibility: sufficient color contrast, logical reading order.
13. If a brand or company is mentioned, adapt content to match that brand.`;
}
