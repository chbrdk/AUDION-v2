import {
  JOURNEY_PROMPT_SITE_COMPONENT_LIBRARY,
  JOURNEY_PROMPT_SITE_RENDER_MODE,
} from './journey-prompt-site';

describe('journey-prompt-site', () => {
  it('fixes library and render mode for journey → Figma pipeline', () => {
    expect(JOURNEY_PROMPT_SITE_COMPONENT_LIBRARY).toBe('default');
    expect(JOURNEY_PROMPT_SITE_RENDER_MODE).toBe('free');
  });
});
