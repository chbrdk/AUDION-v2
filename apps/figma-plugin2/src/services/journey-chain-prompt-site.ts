import {
  JOURNEY_PROMPT_SITE_COMPONENT_LIBRARY,
  JOURNEY_PROMPT_SITE_RENDER_MODE,
} from '../config/journey-prompt-site';

/** Message body for `parent.postMessage({ pluginMessage: … })` — journey → CREATION → Figma. */
export function buildJourneyChainPromptSitePluginMessage(args: {
  prompt: string;
  viewport: string;
  sectionConcepts: unknown[] | null | undefined;
  /** Optional: inserts handoff frame beside the wireframe in Figma. */
  handoffPack?: { conceptDocument: string; figmaMakePrompt: string } | null;
}) {
  const vp =
    args.viewport === 'tablet' || args.viewport === 'mobile' ? args.viewport : 'desktop';
  const concepts = args.sectionConcepts;
  const hp = args.handoffPack;
  const handoff =
    hp &&
    hp.conceptDocument.trim().length > 0 &&
    hp.figmaMakePrompt.trim().length > 0
      ? { conceptDocument: hp.conceptDocument.trim(), figmaMakePrompt: hp.figmaMakePrompt.trim() }
      : undefined;
  return {
    type: 'prompt-site-to-figma' as const,
    prompt: args.prompt,
    viewport: vp,
    componentLibrary: JOURNEY_PROMPT_SITE_COMPONENT_LIBRARY,
    renderMode: JOURNEY_PROMPT_SITE_RENDER_MODE,
    ...(Array.isArray(concepts) && concepts.length > 0 ? { sectionConcepts: concepts } : {}),
    ...(handoff ? { handoffPack: handoff } : {}),
  };
}
