import {
  HTML_FIGMA_CSS_REGRESSION_FIXTURE_PATH,
  CREATION_JOURNEY_SCREEN_BRIEF_PATH,
  getHtmlFigmaCssRegressionFixtureUrl,
} from './urls';

describe('CREATION_JOURNEY_SCREEN_BRIEF_PATH', () => {
  it('is the journey-screen-brief API path', () => {
    expect(CREATION_JOURNEY_SCREEN_BRIEF_PATH).toBe('/api/v1/journey-screen-brief');
  });
});

describe('getHtmlFigmaCssRegressionFixtureUrl', () => {
  it('appends fixture path without duplicate slash', () => {
    expect(getHtmlFigmaCssRegressionFixtureUrl('https://creation.example.com')).toBe(
      `https://creation.example.com${HTML_FIGMA_CSS_REGRESSION_FIXTURE_PATH}`
    );
  });

  it('strips trailing slash from base', () => {
    expect(getHtmlFigmaCssRegressionFixtureUrl('https://creation.example.com/')).toBe(
      `https://creation.example.com${HTML_FIGMA_CSS_REGRESSION_FIXTURE_PATH}`
    );
  });
});
