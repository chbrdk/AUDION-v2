import { parseDSL, DSLParseError, DSLValidationError } from './parser';

describe('parseDSL', () => {
  it('parses valid root with page and children', () => {
    const json = '{"page": "Test", "children": []}';
    const dsl = parseDSL(json);
    expect(dsl.page).toBe('Test');
    expect(dsl.children).toEqual([]);
  });

  it('parses root with section child', () => {
    const json = '{"page": "P", "children": [{"type": "section", "name": "Hero", "children": []}]}';
    const dsl = parseDSL(json);
    expect(dsl.children).toHaveLength(1);
    expect((dsl.children[0] as { type: string }).type).toBe('section');
  });

  it('strips markdown code fences', () => {
    const wrapped = '```json\n{"page": "X", "children": []}\n```';
    const dsl = parseDSL(wrapped);
    expect(dsl.page).toBe('X');
  });

  it('throws DSLParseError on invalid JSON', () => {
    expect(() => parseDSL('not json')).toThrow(DSLParseError);
    expect(() => parseDSL('{')).toThrow(DSLParseError);
  });

  it('throws DSLValidationError when page is missing', () => {
    expect(() => parseDSL('{"children": []}')).toThrow(DSLValidationError);
  });

  it('throws DSLValidationError when children is not array', () => {
    expect(() => parseDSL('{"page": "P", "children": null}')).toThrow(DSLValidationError);
  });

  it('normalizes keyed format: single-key node becomes type + props', () => {
    const json = '{"page": "P", "children": [{"section": {"padding": [80, 24], "children": []}}]}';
    const dsl = parseDSL(json);
    expect(dsl.children).toHaveLength(1);
    const section = dsl.children[0] as { type: string; padding?: number[] };
    expect(section.type).toBe('section');
    expect(section.padding).toEqual([80, 24]);
  });

  it('normalizes nested keyed nodes (section > text)', () => {
    const json = '{"page": "P", "children": [{"section": {"children": [{"text": {"content": "Hi", "style": "body"}}]}}]}';
    const dsl = parseDSL(json);
    const section = dsl.children[0] as { type: string; children: { type: string; content?: string }[] };
    expect(section.type).toBe('section');
    expect(section.children).toHaveLength(1);
    expect(section.children[0].type).toBe('text');
    expect(section.children[0].content).toBe('Hi');
  });

  it('normalizes hero with cta/image objects to label and src', () => {
    const json = '{"page": "P", "children": [{"hero": {"headline": "Title", "cta": {"label": "Click", "variant": "primary"}, "image": {"src": "https://x.com/img.jpg", "alt": "Img"}}}]}';
    const dsl = parseDSL(json);
    const hero = dsl.children[0] as { type: string; headline?: string; cta?: string; image?: string };
    expect(hero.type).toBe('hero');
    expect(hero.headline).toBe('Title');
    expect(hero.cta).toBe('Click');
    expect(hero.image).toBe('https://x.com/img.jpg');
  });

  it('accepts single node as root (selection/read-DSL format)', () => {
    const json = '{"type": "frame", "name": "Service Page V1", "width": 800, "children": [{"type": "text", "content": "Hi", "style": "body"}]}';
    const dsl = parseDSL(json);
    expect(dsl.page).toBe('Service Page V1');
    expect(dsl.width).toBe(800);
    expect(dsl.children).toHaveLength(1);
    const frame = dsl.children[0] as { type: string; name?: string; children?: unknown[] };
    expect(frame.type).toBe('frame');
    expect(frame.children).toHaveLength(1);
  });
});
