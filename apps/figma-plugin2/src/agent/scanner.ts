import { ScannedComponent } from '../types';

/**
 * Scans the selected nodes and extracts metadata for components and component sets.
 */
export function scanSelectedComponents(): ScannedComponent[] {
  const selection = figma.currentPage.selection;
  const scanned: ScannedComponent[] = [];

  function traverse(nodes: readonly SceneNode[]) {
    for (const node of nodes) {
      if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
        scanned.push(analyzeComponent(node));
      } else if (node.type === 'INSTANCE') {
        const mainComponent = node.mainComponent;
        if (mainComponent) {
          if (mainComponent.parent && mainComponent.parent.type === 'COMPONENT_SET') {
            scanned.push(analyzeComponent(mainComponent.parent as ComponentSetNode));
          } else {
            scanned.push(analyzeComponent(mainComponent));
          }
        }
      } else if ('children' in node) {
        // Recursively check children of frames, groups, sections etc.
        traverse(node.children as readonly SceneNode[]);
      }
    }
  }

  traverse(selection);

  // Deduplicate by ID
  const unique = new Map<string, ScannedComponent>();
  for (const item of scanned) {
    unique.set(item.id, item);
  }

  return Array.from(unique.values());
}

function analyzeComponent(node: ComponentNode | ComponentSetNode): ScannedComponent {
  const name = node.name;
  const description = node.description || '';
  const variants: Record<string, string[]> = {};
  const properties: Array<{ name: string; type: string; defaultValue?: string }> = [];

  if (node.type === 'COMPONENT_SET') {
    for (const [propName, propInfo] of Object.entries(node.componentPropertyDefinitions)) {
      if (propInfo.type === 'VARIANT') {
        variants[propName] = propInfo.variantOptions || [];
      }
      properties.push({
        name: propName,
        type: propInfo.type,
        defaultValue: String(propInfo.defaultValue)
      });
    }
  } else {
    for (const [propName, propInfo] of Object.entries(node.componentPropertyDefinitions)) {
      properties.push({
        name: propName,
        type: propInfo.type,
        defaultValue: String(propInfo.defaultValue)
      });
    }
  }

  // Build documentation string for LLM
  let doc = `Component: ${name}\n`;
  if (description) doc += `Description: ${description}\n`;
  
  if (Object.keys(variants).length > 0) {
    doc += `Variants:\n`;
    for (const [vName, vOptions] of Object.entries(variants)) {
      doc += `- ${vName}: [${vOptions.join(', ')}]\n`;
    }
  }

  if (properties.length > 0) {
    doc += `Properties:\n`;
    for (const prop of properties) {
      if (prop.type !== 'VARIANT') {
        doc += `- ${prop.name} (${prop.type}): default is "${prop.defaultValue}"\n`;
      }
    }
  }

  // Deep Analysis: Visual Blueprint
  // If it's a set, analyze the first variant as a representative
  const representative = node.type === 'COMPONENT_SET' ? node.children[0] as ComponentNode : node;
  const blueprint = representative ? generateBlueprint(representative) : '';

  return {
    id: (node as any).key || node.id,
    name,
    description,
    documentation: doc,
    visualBlueprint: blueprint,
    variants,
    properties
  };
}

function generateBlueprint(node: SceneNode, indent = 0): string {
  const prefix = '  '.repeat(indent);
  const specs = extractVisualSpecs(node);
  let bluePrint = `${prefix}- ${node.name} (${node.type}): ${specs}\n`;

  if ('children' in node) {
    for (const child of node.children) {
      bluePrint += generateBlueprint(child, indent + 1);
    }
  }

  return bluePrint;
}

function extractVisualSpecs(node: SceneNode): string {
  const parts: string[] = [];

  // Corner Radius
  if ('cornerRadius' in node && typeof node.cornerRadius === 'number' && node.cornerRadius > 0) {
    parts.push(`radius: ${node.cornerRadius}px`);
  }

  // Padding & Layout
  if ('layoutMode' in node && node.layoutMode !== 'NONE') {
    parts.push(`layout: ${node.layoutMode}`);
    if ('paddingLeft' in node) parts.push(`padding: ${String(node.paddingTop)} ${String(node.paddingRight)} ${String(node.paddingBottom)} ${String(node.paddingLeft)}`);
    if ('itemSpacing' in node && typeof node.itemSpacing === 'number' && node.itemSpacing > 0) parts.push(`gap: ${node.itemSpacing}px`);
  }

  // Fills (Colors)
  if ('fills' in node && Array.isArray(node.fills)) {
    const solidFills = node.fills.filter(f => f.type === 'SOLID');
    if (solidFills.length > 0) {
      const f = solidFills[0] as SolidPaint;
      const hex = rgbToHex(f.color.r, f.color.g, f.color.b);
      parts.push(`fill: ${hex}`);
    }
  }

  // Text
  if (node.type === 'TEXT') {
    parts.push(`font: ${String(node.fontSize)}px`);
    if (node.characters) {
      const sample = node.characters.length > 20 ? node.characters.substring(0, 17) + '...' : node.characters;
      parts.push(`text: "${sample}"`);
    }
  }
  
  // Strokes
  if ('strokes' in node && Array.isArray(node.strokes) && node.strokes.length > 0) {
    const s = node.strokes[0] as SolidPaint;
    if (s && s.type === 'SOLID') {
       parts.push(`stroke: ${rgbToHex(s.color.r, s.color.g, s.color.b)} (${String(node.strokeWeight)}px)`);
    }
  }

  return parts.join(', ');
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) => Math.round(c * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}
