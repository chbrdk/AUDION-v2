import { applyMsqdxSectionConceptPluginData } from './apply-msqdx-section-plugin-data';
import {
  MSQDX_LAYER_CONCEPT_PAYLOAD_FIELD,
  MSQDX_SECTION_CONCEPT_PLUGIN_DATA_KEY,
} from '../config/msqdx-section-metadata';

describe('applyMsqdxSectionConceptPluginData', () => {
  it('calls setPluginData on FRAME when payload present', () => {
    const setPluginData = jest.fn();
    const node = { type: 'FRAME', setPluginData } as unknown as SceneNode;
    const json = JSON.stringify({ v: 1, concept: { sectionId: 'hero' } });
    applyMsqdxSectionConceptPluginData(node, {
      [MSQDX_LAYER_CONCEPT_PAYLOAD_FIELD]: json,
    });
    expect(setPluginData).toHaveBeenCalledWith(MSQDX_SECTION_CONCEPT_PLUGIN_DATA_KEY, json);
  });

  it('skips non-FRAME nodes', () => {
    const setPluginData = jest.fn();
    const node = { type: 'RECTANGLE', setPluginData } as unknown as SceneNode;
    applyMsqdxSectionConceptPluginData(node, {
      [MSQDX_LAYER_CONCEPT_PAYLOAD_FIELD]: '{}',
    });
    expect(setPluginData).not.toHaveBeenCalled();
  });
});
