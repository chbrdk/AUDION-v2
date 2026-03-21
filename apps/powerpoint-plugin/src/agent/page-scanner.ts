import type { ScannedPage, ScannedPageSection } from '../types';

/**
 * Scans the current selection as a single page/template (Frame or Group).
 * Extracts structure (ordered sections) and component refs used in the page.
 * Returns null if selection is not exactly one Frame or Group.
 */
export function scanSelectedPage(): ScannedPage | null {
  const selection = figma.currentPage.selection;
  if (selection.length !== 1) return null;

  const root = selection[0];
  if (root.type !== 'FRAME' && root.type !== 'GROUP') return null;

  if (!('children' in root)) return null;

  const structure: ScannedPageSection[] = [];
  const componentRefsSet = new Set<string>();

  for (const child of root.children) {
    const section: ScannedPageSection = { name: child.name };
    const childNames: string[] = [];
    const sectionComponentIds: string[] = [];

    if (child.type === 'INSTANCE' && child.mainComponent) {
      const comp = child.mainComponent;
      const compId = (comp as any).key || comp.id;
      const compName = comp.name;
      sectionComponentIds.push(compId);
      componentRefsSet.add(compId);
      if ('children' in child && child.children.length > 0) {
        for (const c of child.children) {
          childNames.push(c.name);
        }
      }
    } else if ('children' in child) {
      for (const c of child.children) {
        childNames.push(c.name);
        if (c.type === 'INSTANCE' && c.mainComponent) {
          const compId = (c.mainComponent as any).key || c.mainComponent.id;
          sectionComponentIds.push(compId);
          componentRefsSet.add(compId);
        }
      }
    }

    if (sectionComponentIds.length > 0) section.componentIds = sectionComponentIds;
    if (childNames.length > 0) section.childNames = childNames;
    structure.push(section);
  }

  const componentRefs = Array.from(componentRefsSet);
  const blueprintSummary = structure.length > 0
    ? structure.map(s => s.name).join(' → ')
    : root.name;

  const id = root.id;
  const name = root.name;
  const description = 'description' in root && typeof (root as any).description === 'string'
    ? (root as any).description
    : undefined;

  return {
    id,
    name,
    description,
    pageType: inferPageType(name, description),
    structure,
    componentRefs,
    blueprintSummary,
  };
}

function inferPageType(name: string, description?: string): 'landing' | 'dashboard' | 'article' | 'generic' {
  const lower = `${name} ${description ?? ''}`.toLowerCase();
  if (/\blanding\b|home\s*page|hero\s*page/i.test(lower)) return 'landing';
  if (/\bdashboard\b|admin\b|panel\b/i.test(lower)) return 'dashboard';
  if (/\barticle\b|blog\b|post\b|content\s*page/i.test(lower)) return 'article';
  return 'generic';
}
