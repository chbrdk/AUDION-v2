import { buildJourneyScreenBriefRequestBody } from './journey-screen-brief-payload';
import type { JourneyResponse, Persona, TargetGroup } from '../types';

const journey: JourneyResponse = {
  id: 'j1',
  name: 'Buy',
  journey_type: 'conversion',
  description: 'Desc',
  status: 'active',
  phases: [
    {
      id: 'p1',
      name: 'Cart',
      phase_order: 1,
      elements: [
        { id: 'e1', element_type: 'text', content: 'Hi', element_order: 1 },
      ],
    },
  ],
};

const persona: Persona = {
  id: 'per1',
  name: 'Alex',
  segment: 'SMB',
  headline: 'Wants speed',
};

describe('buildJourneyScreenBriefRequestBody', () => {
  it('builds body with journey, phaseId, persona', () => {
    const body = buildJourneyScreenBriefRequestBody(journey, 'p1', persona, { locale: 'en' });
    expect(body.phaseId).toBe('p1');
    expect(body.journey.id).toBe('j1');
    expect(body.journey.phases).toHaveLength(1);
    expect(body.persona.segment).toBe('SMB');
    expect(body.locale).toBe('en');
  });

  it('throws for unknown phase', () => {
    expect(() => buildJourneyScreenBriefRequestBody(journey, 'missing', persona)).toThrow(
      'Unknown phaseId'
    );
  });

  it('includes optional target group', () => {
    const tg: TargetGroup = { id: 'tg1', name: 'Builders', description: 'DIY' };
    const body = buildJourneyScreenBriefRequestBody(journey, 'p1', persona, { targetGroup: tg });
    expect(body.targetGroup?.id).toBe('tg1');
    expect(body.targetGroup?.description).toBe('DIY');
  });

  it('strips JSON null so CREATION Zod accepts the body', () => {
    const messy = {
      id: 'j1',
      name: null,
      journey_type: null,
      description: null,
      status: 'active',
      phases: [
        {
          id: 'p1',
          name: null,
          description: null,
          phase_order: 1,
          elements: [
            { id: null, element_type: null, content: null, element_order: 1, metadata: null },
          ],
        },
      ],
    } as unknown as JourneyResponse;
    const body = buildJourneyScreenBriefRequestBody(messy, 'p1', persona);
    expect(JSON.stringify(body)).not.toContain('null');
    expect(body.journey.name).toBe('Journey');
    expect(body.journey.phases[0].elements[0].element_type).toBe('unknown');
    expect(body.journey.phases[0].elements[0].content).toBe('');
  });
});
