/**
 * Font loading for DSL converter. Pre-load all typography refs before rendering.
 */

import type { DSLRoot, DSLNode, DSLText } from './types';
import type { ResolvedTokens } from './tokens';

const fontCache = new Set<string>();

export async function ensureFont(
  family: string,
  style: string
): Promise<FontName> {
  const key = `${family}::${style}`;

  if (!fontCache.has(key)) {
    try {
      await figma.loadFontAsync({ family, style });
      fontCache.add(key);
    } catch {
      const fallbacks: FontName[] = [
        { family: 'Inter', style },
        { family: 'Inter', style: 'Regular' },
        { family: 'Roboto', style: 'Regular' },
      ];
      for (const fb of fallbacks) {
        try {
          await figma.loadFontAsync(fb);
          fontCache.add(key);
          return fb;
        } catch {
          continue;
        }
      }
      const defaultFont: FontName = { family: 'Inter', style: 'Regular' };
      await figma.loadFontAsync(defaultFont);
      fontCache.add(key);
      return defaultFont;
    }
  }

  return { family, style };
}

function collectFromNode(node: DSLNode, styles: Set<string>): void {
  if (node.type === 'text') {
    const style = (node as DSLText).style ?? 'body';
    styles.add(style);
  }
  const children =
    'children' in node && Array.isArray(node.children) ? node.children : [];
  for (const child of children) {
    collectFromNode(child, styles);
  }
}

export function collectTextStyles(
  root: DSLRoot,
  _tokens: ResolvedTokens
): string[] {
  const set = new Set<string>();
  for (const child of root.children) {
    collectFromNode(child, set);
  }
  return [...set];
}

export async function preloadFontsForDSL(
  root: DSLRoot,
  tokens: ResolvedTokens
): Promise<void> {
  const styles = collectTextStyles(root, tokens);
  const uniqueFonts = new Set<string>();

  for (const style of styles) {
    const typo = tokens.typography[style];
    if (typo) {
      uniqueFonts.add(`${typo.family}::${typo.style}`);
    }
  }

  await Promise.all(
    [...uniqueFonts].map((key) => {
      const [family, style] = key.split('::');
      return ensureFont(family, style);
    })
  );
}
