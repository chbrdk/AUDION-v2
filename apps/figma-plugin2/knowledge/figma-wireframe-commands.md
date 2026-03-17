# Figma Wireframe Command Whitelist

Stand: März 2026. Typings: `@figma/plugin-typings` (aktuell 1.123.0) – vor Updates prüfen mit `npm info @figma/plugin-typings version`. Diese Whitelist definiert die einzigen Operationen, die der Figma Executor Agent ausgeben darf. Der Command-Interpreter führt ausschließlich diese Befehle aus (kein generierter Code).

## Referenzen

- [Figma Plugin API – figma object](https://developers.figma.com/docs/plugins/api/figma/)
- [Figma Plugin API – Node types](https://www.figma.com/plugin-docs/api/nodes/)
- [Figma Plugin Typings](https://developers.figma.com/docs/plugins/api/typings/) – `@figma/plugin-typings`

## Erlaubte Befehle (op)

| op | Figma-API | Verwendung |
|----|-----------|------------|
| `loadFont` | `figma.loadFontAsync({ family, style })` | Vor jedem createText mit neuer Font |
| `createFrame` | `figma.createFrame()` | Container, Sektionen, Cards |
| `createRectangle` | `figma.createRectangle()` | Platzhalter, Divider, Flächen |
| `createEllipse` | `figma.createEllipse()` | Icons, Avatare |
| `createLine` | `figma.createLine()` | Trennlinien (resize(width, 0)) |
| `createText` | `figma.createText()` | Alle Texte (nach loadFont) |
| `appendChild` | `parent.appendChild(child)` | Hierarchie (IDs aus Command-Liste) |
| `group` | `figma.group(nodes, parent, index)` | Gruppierung |

## Erlaubte Properties pro Befehl

### loadFont
- `family`: string
- `style`: string

### createFrame
- `id`, `name`, `width`, `height`
- `layoutMode`: "NONE" | "HORIZONTAL" | "VERTICAL"
- `primaryAxisSizingMode`, `counterAxisSizingMode`: "FIXED" | "AUTO"
- `primaryAxisAlignItems`, `counterAxisAlignItems`
- `itemSpacing`, `paddingTop`, `paddingBottom`, `paddingLeft`, `paddingRight`
- `fills`, `strokes` (Array von `{ type: "SOLID", color: { r, g, b }, opacity? }`)
- `strokeWeight`, `cornerRadius`, `clipsContent`, `opacity`, `x`, `y`

### createRectangle / createEllipse
- `id`, `name`, `width`, `height`
- `fills`, `strokes`, `strokeWeight`, `cornerRadius` (nur Rectangle), `opacity`, `x`, `y`

### createLine
- `id`, `name`, `x1`, `y1`, `x2`, `y2`, `strokes`, `strokeWeight`

### createText
- `id`, `name`, `characters`, `fontSize`, `fontFamily`, `fontStyle`
- `fills`, `textAlignHorizontal`, `textAutoResize`, `opacity`, `x`, `y`

### appendChild
- `parentId`, `childId`

### group
- `id`, `name`, `childIds` (string[]), `parentId`, `index?`

## Farben

RGB 0–1: `{ r, g, b }`. In Fills/Strokes: `{ type: "SOLID", color: { r, g, b }, opacity? }`.

## Nicht in der Whitelist

- createPolygon, createStar, createVector
- createComponent, createPage, createSection (SectionNode)
- createTextPath
- FigJam/Slides-spezifische APIs
