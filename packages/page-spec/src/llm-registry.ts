/**
 * Short doc string for embedding in CREATION / Anthropic system prompts.
 * Keep in sync with {@link PAGE_BLOCK_TYPES} and `pageSpecSchema`.
 */
export const PAGE_SPEC_LLM_REGISTRY_DOC = `
Allowed block types: hero, featureGrid, cta, footer, logoStrip, testimonial, richText, cardGrid.
Each block includes "type". Optional "id" on any block.
Top-level PageSpec: title, description?, brand?, blocks[].
`.trim();
