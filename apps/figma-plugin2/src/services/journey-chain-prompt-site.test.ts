import { buildJourneyChainPromptSitePluginMessage } from './journey-chain-prompt-site';

describe('buildJourneyChainPromptSitePluginMessage', () => {
  it('normalizes viewport and omits empty sectionConcepts', () => {
    const m = buildJourneyChainPromptSitePluginMessage({
      prompt: 'x',
      viewport: 'bogus',
      sectionConcepts: [],
    });
    expect(m.type).toBe('prompt-site-to-figma');
    expect(m.viewport).toBe('desktop');
    expect('sectionConcepts' in m).toBe(false);
  });

  it('passes sectionConcepts when non-empty', () => {
    const m = buildJourneyChainPromptSitePluginMessage({
      prompt: 'p',
      viewport: 'tablet',
      sectionConcepts: [{ sectionId: 'hero' }],
    });
    expect(m.viewport).toBe('tablet');
    expect(Array.isArray((m as { sectionConcepts?: unknown[] }).sectionConcepts)).toBe(true);
  });

  it('passes handoffPack when both strings non-empty', () => {
    const m = buildJourneyChainPromptSitePluginMessage({
      prompt: 'p',
      viewport: 'desktop',
      sectionConcepts: [],
      handoffPack: { conceptDocument: '  c  ', figmaMakePrompt: '  f  ' },
    });
    expect((m as { handoffPack?: { conceptDocument: string } }).handoffPack?.conceptDocument).toBe('c');
  });
});
