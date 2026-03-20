import { formatPromptSitePdsLines, summarizeCaptureStyleMerge } from './prompt-site-render-meta';

describe('prompt-site-render-meta', () => {
  it('formatPromptSitePdsLines includes registry, emitter, capture warnings, renderer warnings', () => {
    const lines = formatPromptSitePdsLines(
      {
        registryVersion: '3.0.0-mvp-3',
        emitterVersion: '1.0.0',
        captureStyleMerge: { transformWarningCount: 2 },
        rendererWarnings: ['a', 'b', 'c'],
      },
      'en'
    );
    expect(lines.some((l) => l.includes('3.0.0-mvp-3'))).toBe(true);
    expect(lines.some((l) => l.includes('1.0.0'))).toBe(true);
    expect(lines.some((l) => l.includes('2'))).toBe(true);
    expect(lines.some((l) => l.includes('a | b'))).toBe(true);
    expect(lines.some((l) => l.includes('(+1)'))).toBe(true);
  });

  it('summarizeCaptureStyleMerge returns null when no transform warnings', () => {
    expect(summarizeCaptureStyleMerge({ transformWarningCount: 0 }, 'de')).toBeNull();
    expect(summarizeCaptureStyleMerge(undefined, 'de')).toBeNull();
  });
});
