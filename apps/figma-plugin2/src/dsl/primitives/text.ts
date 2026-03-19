import type { DSLText } from '../types';
import type { RenderContext } from '../renderer';
import { resolveColor } from '../tokens';
import { ensureFont } from '../fonts';

export async function renderText(
  node: DSLText,
  ctx: RenderContext
): Promise<TextNode> {
  const styleName = node.style ?? 'body';
  const typo = ctx.tokens.typography[styleName] ?? ctx.tokens.typography.body!;
  const font = await ensureFont(typo.family, typo.style);

  const text = figma.createText();
  text.name = 'Text';
  text.characters = node.content;
  text.fontName = font;
  text.fontSize = typo.size;
  text.lineHeight = { value: typo.lineHeight * 100, unit: 'PERCENT' };
  if (node.fill) {
    text.fills = [
      {
        type: 'SOLID',
        color: resolveColor(node.fill, ctx.tokens),
        opacity: 1,
      },
    ];
  } else {
    text.fills = [
      {
        type: 'SOLID',
        color: resolveColor('$text.primary', ctx.tokens),
        opacity: 1,
      },
    ];
  }
  if (node.align === 'center') text.textAlignHorizontal = 'CENTER';
  else if (node.align === 'right') text.textAlignHorizontal = 'RIGHT';
  else text.textAlignHorizontal = 'LEFT';
  if (node.lineHeight != null) {
    text.lineHeight = { value: node.lineHeight * 100, unit: 'PERCENT' };
  }
  if (node.letterSpacing != null) {
    text.letterSpacing = { value: node.letterSpacing, unit: 'PIXELS' };
  }
  if (node.maxWidth != null) {
    text.resize(node.maxWidth, 1000);
  }

  return text;
}
