import { MSQDX_SECTION_CONCEPT_PLUGIN_DATA_KEY } from './msqdx-section-metadata';

describe('msqdx-section-metadata', () => {
  it('matches CREATION plugin-data key constant', () => {
    expect(MSQDX_SECTION_CONCEPT_PLUGIN_DATA_KEY).toBe('msqdx/sectionConcept/v1');
  });
});
