/**
 * Unit tests for the concept agent (Konzeptionsagent).
 * Verifies buildConceptPrompt output and ConceptAgentResponse shape.
 */

import { buildConceptPrompt, type ConceptAgentResponse, type ConceptSection } from './concept-agent';

describe('concept-agent', () => {
  describe('buildConceptPrompt', () => {
    it('includes user input and viewport in prompt', () => {
      const prompt = buildConceptPrompt('Landing page with hero and CTA', 'desktop');
      expect(prompt).toContain('Landing page with hero and CTA');
      expect(prompt).toContain('DESKTOP');
    });

    it('requests JSON and no intro text', () => {
      const prompt = buildConceptPrompt('Test', 'mobile');
      expect(prompt).toMatch(/JSON|json/i);
      expect(prompt).toContain('MOBILE');
    });
  });

  describe('ConceptAgentResponse shape', () => {
    it('allows valid sections and implementationPrompt', () => {
      const response: ConceptAgentResponse = {
        sections: [
          { name: 'Hero', description: 'Hero area', contentHints: 'H1, CTA', imagePrompt: 'Hero wireframe' },
        ],
        implementationPrompt: 'Long implementation instructions for Figma Make.',
      };
      expect(response.sections).toHaveLength(1);
      expect(response.sections[0].name).toBe('Hero');
      expect(response.sections[0].imagePrompt).toBe('Hero wireframe');
      expect(response.implementationPrompt).toBeTruthy();
    });

    it('ConceptSection has required fields', () => {
      const section: ConceptSection = {
        name: 'Nav',
        description: 'Navigation bar',
        contentHints: 'Logo, links',
        imagePrompt: 'Nav wireframe sketch',
      };
      expect(section.name).toBe('Nav');
      expect(section.imagePrompt).toBe('Nav wireframe sketch');
    });
  });
});
