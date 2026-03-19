/**
 * figma-variables – getOrCreateWireframeVariables returns null when not in plugin.
 * Full variable creation is only testable in Figma plugin runtime.
 */

import { getOrCreateWireframeVariables } from './figma-variables';

describe('figma-variables', () => {
  it('getOrCreateWireframeVariables returns null when figma is not defined', async () => {
    const result = await getOrCreateWireframeVariables();
    expect(result).toBeNull();
  });
});
