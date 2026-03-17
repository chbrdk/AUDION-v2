/**
 * Unit tests for wireframe tool agent (schemas and run loop error path).
 */

import {
  FIGMA_WIREFRAME_TOOLS,
  WIREFRAME_TOOL_AGENT_SYSTEM_PROMPT,
  runWireframeToolAgent,
} from './wireframe-tool-agent';

describe('wireframe-tool-agent', () => {
  it('exposes 24 tools with expected names', () => {
    expect(FIGMA_WIREFRAME_TOOLS).toHaveLength(24);
    const names = FIGMA_WIREFRAME_TOOLS.map((t) => t.function.name).sort();
    expect(names).toEqual([
      'addPlaceholderImage',
      'addSvg',
      'addText',
      'createAvatar',
      'createBadge',
      'createButton',
      'createButtonRow',
      'createCard',
      'createCheckbox',
      'createDivider',
      'createForm',
      'createHeader',
      'createHero',
      'createIconButton',
      'createInput',
      'createList',
      'createRadio',
      'createRow',
      'createSection',
      'createSpacer',
      'createTable',
      'createTextarea',
      'groupNodes',
      'setLayout',
    ]);
  });

  it('createSection tool has required parentId and name', () => {
    const createSectionTool = FIGMA_WIREFRAME_TOOLS.find((t) => t.function.name === 'createSection');
    expect(createSectionTool).toBeDefined();
    expect(createSectionTool!.function.parameters.required).toContain('parentId');
    expect(createSectionTool!.function.parameters.required).toContain('name');
  });

  it('system prompt mentions stage and createSection', () => {
    expect(WIREFRAME_TOOL_AGENT_SYSTEM_PROMPT).toContain('stage');
    expect(WIREFRAME_TOOL_AGENT_SYSTEM_PROMPT).toContain('createSection');
  });

  it('runWireframeToolAgent returns error when fetch returns non-ok', async () => {
    const nodeMap = new Map();
    const result = await runWireframeToolAgent({
      fetch: async () => ({ ok: false, text: async () => 'Server Error' }) as Response,
      apiKey: 'test-key',
      model: 'gpt-4o-mini',
      userPrompt: 'Hero section',
      viewport: 'desktop',
      nodeMap,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('OpenAI');
    }
  });
});
