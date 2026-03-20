import {
  HTML_FIGMA_CSS_REGRESSION_FIXTURE_PATH,
  getHtmlFigmaCssRegressionFixtureUrl,
} from './urls';

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
