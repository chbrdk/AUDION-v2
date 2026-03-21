import {
  buildImportedSectionRow,
  parseImportedSectionsPayload,
} from './journey-imported-section';
import { MSQDX_LAYER_CONCEPT_PAYLOAD_FIELD } from '../config/msqdx-section-metadata';

describe('journey-imported-section', () => {
  describe('buildImportedSectionRow', () => {
    it('returns null when payload field missing', () => {
      expect(buildImportedSectionRow('1:2', {})).toBeNull();
    });

    it('parses concept JSON into row', () => {
      const payload = JSON.stringify({
        concept: {
          sectionId: 'hero',
          label: 'Hero',
          phaseFit: 'Awareness',
          personaAngle: 'Founder',
          informationGoal: 'Trust',
        },
      });
      const layer = { [MSQDX_LAYER_CONCEPT_PAYLOAD_FIELD]: payload };
      const row = buildImportedSectionRow('10:20', layer);
      expect(row).toMatchObject({
        nodeId: '10:20',
        sectionId: 'hero',
        label: 'Hero',
      });
      expect(row?.summary).toContain('Awareness');
      expect(row?.detailJson).toContain('hero');
    });
  });

  describe('parseImportedSectionsPayload', () => {
    it('returns empty for non-array', () => {
      expect(parseImportedSectionsPayload(null)).toEqual([]);
      expect(parseImportedSectionsPayload({})).toEqual([]);
    });

    it('keeps valid rows only', () => {
      const rows = parseImportedSectionsPayload([
        {
          nodeId: '1:1',
          sectionId: 'a',
          summary: 's',
          detailJson: '{}',
          label: 'L',
        },
        { nodeId: 'x' },
      ]);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.label).toBe('L');
    });
  });
});
