/**
 * Extracts components from Figma selection for RAG "add components" flow.
 * For component sets: includes all variants and property definitions so the
 * backend stores one entry with full variant/option data instead of one per variant.
 */

/** Property definition shape accepted by CREATION add-components (matches catalog). */
export interface RAGPropertyDef {
  type: string;
  name: string;
  fullName: string;
  defaultValue?: string | boolean;
  options?: string[];
  preferredValues?: Array<{ type: string; key: string }>;
}

/** Variant combination (name, key, property map). */
export interface RAGVariantCombination {
  name: string;
  key: string;
  properties: Record<string, string>;
}

export interface RAGComponentPayload {
  key: string;
  name: string;
  nodeId: string;
  description: string;
  componentType: 'component' | 'component_set';
  bounds?: { x: number; y: number; width: number; height: number };
  /** Filled for component sets from componentPropertyDefinitions. */
  properties?: Record<string, RAGPropertyDef>;
  /** Filled for component sets from children (each child = one variant). */
  variants?: RAGVariantCombination[];
  variantCount?: number;
  /** Optional text layer names from default variant (first child). */
  textLayers?: Array<{ name: string }>;
}

/** Figma plugin API: component property definition on a node. */
interface FigmaComponentPropertyDef {
  type: 'VARIANT' | 'BOOLEAN' | 'TEXT' | 'INSTANCE_SWAP';
  defaultValue?: string | boolean;
  variantOptions?: string[];
  preferredValues?: Array<{ type: string; key: string }>;
}

function getComponentPropertyDefinitions(
  node: ComponentNode | ComponentSetNode
): Record<string, FigmaComponentPropertyDef> {
  const defs = (node as unknown as { componentPropertyDefinitions?: Record<string, FigmaComponentPropertyDef> })
    .componentPropertyDefinitions;
  return defs && typeof defs === 'object' ? defs : {};
}

function extractPropertiesFromSet(
  node: ComponentSetNode
): Record<string, RAGPropertyDef> {
  const defs = getComponentPropertyDefinitions(node);
  const result: Record<string, RAGPropertyDef> = {};
  for (const [fullName, def] of Object.entries(defs)) {
    const name = fullName.split('#')[0];
    const prop: RAGPropertyDef = {
      type: def.type,
      name,
      fullName,
      defaultValue: def.defaultValue,
    };
    if (def.type === 'VARIANT' && def.variantOptions?.length) {
      prop.options = def.variantOptions;
    }
    if (def.type === 'INSTANCE_SWAP' && def.preferredValues?.length) {
      prop.preferredValues = def.preferredValues;
    }
    result[fullName] = prop;
  }
  return result;
}

function parseVariantName(name: string): Record<string, string> {
  const properties: Record<string, string> = {};
  const parts = name.split(',').map((p) => p.trim());
  for (const part of parts) {
    const eqIndex = part.indexOf('=');
    if (eqIndex > 0) {
      const propName = part.slice(0, eqIndex).trim();
      const propValue = part.slice(eqIndex + 1).trim();
      properties[propName] = propValue;
    }
  }
  return properties;
}

function extractVariantsFromSet(node: ComponentSetNode): RAGVariantCombination[] {
  const children = 'children' in node && Array.isArray(node.children) ? node.children : [];
  return children
    .filter((c): c is ComponentNode => c.type === 'COMPONENT')
    .map((c) => ({
      name: c.name,
      key: (c as { key?: string }).key ?? c.id,
      properties: parseVariantName(c.name),
    }));
}

function extractTextLayerNamesFromComponent(node: ComponentNode): Array<{ name: string }> {
  try {
    const textNodes = node.findAllWithCriteria?.({ types: ['TEXT'] }) ?? [];
    const names = textNodes.map((n) => n.name).filter(Boolean);
    return [...new Set(names)].map((name) => ({ name }));
  } catch {
    return [];
  }
}

export function getRAGComponentsFromSelection(): RAGComponentPayload[] {
  const selection = figma.currentPage.selection;
  const result: RAGComponentPayload[] = [];
  const seen = new Set<string>();

  function addPayload(payload: RAGComponentPayload | null) {
    if (!payload || seen.has(payload.key)) return;
    seen.add(payload.key);
    result.push(payload);
  }

  function traverse(nodes: readonly SceneNode[]) {
    for (const node of nodes) {
      if (node.type === 'COMPONENT_SET') {
        addPayload(toRAGPayload(node as ComponentSetNode));
      } else if (node.type === 'COMPONENT') {
        const comp = node as ComponentNode;
        const parent = comp.parent;
        if (parent?.type === 'COMPONENT_SET') {
          addPayload(toRAGPayload(parent as ComponentSetNode));
        } else {
          addPayload(toRAGPayload(comp));
        }
      } else if (node.type === 'INSTANCE') {
        const mainComponent = (node as InstanceNode).mainComponent;
        if (mainComponent) {
          const target: ComponentNode | ComponentSetNode =
            mainComponent.parent?.type === 'COMPONENT_SET'
              ? (mainComponent.parent as ComponentSetNode)
              : mainComponent;
          addPayload(toRAGPayload(target));
        }
      } else if ('children' in node) {
        traverse(node.children as readonly SceneNode[]);
      }
    }
  }

  traverse(selection);
  return result;
}

function toRAGPayload(
  node: ComponentNode | ComponentSetNode
): RAGComponentPayload | null {
  const key = (node as { key?: string }).key ?? node.id;
  const payload: RAGComponentPayload = {
    key,
    name: node.name,
    nodeId: node.id,
    description: node.description || '',
    componentType: node.type === 'COMPONENT_SET' ? 'component_set' : 'component',
  };
  if ('absoluteBoundingBox' in node && node.absoluteBoundingBox) {
    const b = node.absoluteBoundingBox;
    payload.bounds = { x: b.x, y: b.y, width: b.width, height: b.height };
  }

  if (node.type === 'COMPONENT_SET') {
    const set = node as ComponentSetNode;
    payload.properties = extractPropertiesFromSet(set);
    const variants = extractVariantsFromSet(set);
    payload.variants = variants;
    payload.variantCount = variants.length;
    const firstChild = 'children' in set && set.children.length > 0 ? set.children[0] : null;
    if (firstChild && firstChild.type === 'COMPONENT') {
      payload.textLayers = extractTextLayerNamesFromComponent(firstChild as ComponentNode);
    }
  }

  return payload;
}
