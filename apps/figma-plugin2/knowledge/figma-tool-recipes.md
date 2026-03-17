# Figma Tool Recipes (Atomic Design)

Recipes define how each tool builds nodes. **Atoms** are the smallest operations; **molecules** compose only atoms (and other molecules). This keeps behaviour reproducible and avoids invalid hierarchies (e.g. appendChild to a rectangle).

## Atomic layer

| Atom | Description | Returns |
|------|-------------|--------|
| **createFrame** | Single FrameNode; optional layoutMode, padding, fills. Stored in nodeMap under `opts.id` or generated id. | `nodeId` |
| **createRectangle** | Single RectangleNode; width, height, fills, cornerRadius, etc. | `nodeId` |
| **createEllipse** | Single EllipseNode; width, height, fills, strokes, strokeWeight, opacity, x, y. Used for circles (avatar) or ovals. | `nodeId` |
| **createLine** | Single LineNode; length, x, y, strokes, strokeWeight. resize(length, 0). Used for dividers. | `nodeId` |
| **createText** | Calls loadFont then creates TextNode; characters, fontSize, fontFamily, fontStyle, fills. | `nodeId` (async) |
| **loadFont** | `figma.loadFontAsync({ family, style })`. Required before createText. | — |
| **appendChild** | Resolves parentId and childId from nodeMap; `parent.appendChild(child)`. Parent must support appendChild (Frame, Page, Group). | — |
| **groupNodes** | Resolves parentId and childIds from nodeMap; `figma.group(nodes, parent)`; stores new GroupNode in nodeMap under groupId. | `{ success, groupId? }` |
| **createSvgNode** | Creates a FrameNode from SVG string via `figma.createNodeFromSvg(svg)`; stores in nodeMap. Plugin context required. | `{ success, nodeId? }` |

- **NodeMap**: `Map<string, SceneNode>`. All atoms and molecules use the same map for a session so that parentId/childId resolve correctly.
- **ID rule**: Only Frames (or Page/Group) may be used as `parentId` in appendChild. Rectangles, text, ellipses, and lines never have children.

## Molecules

### createButton

**Recipe:** Frame (container) + Rectangle (background) + Text (label); rect and text are children of the frame; frame is appended to parentId.

1. **createFrame** with id (e.g. `buttonId`), name `"Button: {label}"`, width (args.width ?? 140), height 44, layoutMode NONE.
2. **createRectangle** with cornerRadius 8, fills/strokes by variant:
   - primary: dark fill, no stroke
   - secondary: light gray fill
   - outline: no fill, stroke 1px
3. **loadFont** Inter Regular.
4. **createText** with characters = label, fontSize 14, fills = white for primary / dark for secondary and outline, position (12, ~15).
5. **appendChild**(buttonId, rectId); **appendChild**(buttonId, textId); **appendChild**(parentId, buttonId).

**Returns:** `{ success: true, buttonId }` or `{ success: false, error }`. Parent must exist in nodeMap and be a container.

### createButtonRow

Creates multiple buttons in a row (horizontal) or column (vertical). Use for CTAs like "Abbrechen" + "Weiter" side by side. Recipe: createFrame (layoutMode HORIZONTAL or VERTICAL, itemSpacing gap) → append to parentId → for each entry in buttons call createButton(parentId: buttonRowId, label, variant). **Returns:** `{ success: true, buttonRowId, buttonIds }`. Args: parentId, buttons: [{ label, variant? }], direction?: 'horizontal' | 'vertical', gap?.

### createStage

Creates the main container frame (Bühne), appends to `figma.currentPage`. Used once before the agent runs (in code.ts). **Returns:** `{ success: true, stageId }`. Viewport-based size (e.g. mobile 390×1024, desktop 1440×1024), layoutMode VERTICAL, primaryAxisSizingMode AUTO.

### createSection

Frame with layoutMode VERTICAL/HORIZONTAL, itemSpacing, padding; **appends to parentId** (stage or rowId). **spacing** preset: `compact` (8/12), `normal` (16/20), `spacious` (24/32) for gap/padding. Optional **align**: `min` \| `center` \| `max` → counterAxisAlignItems (align children). **Returns:** `{ success: true, sectionId }` or `{ success: false, error }`.

### createRow

Horizontal frame for **multi-column layout**. parentId usually `"stage"`. Then createSection(parentId: rowId) for each column (2–3 sections side by side). gap default 24, padding 20. Optional **align**: `min` \| `center` \| `max` for vertical alignment of row content. **Returns:** `{ success: true, rowId }`.

### addText

loadFont (by variant: h1, h2, h3, body, small, caption) → createText → appendChild(parentId, textId). **Returns:** `{ success: true, textId }` or `{ success: false, error }`. Parent must exist in nodeMap and be a container.

### addPlaceholderImage

Image placeholder: gray rectangle with a **centered label** that describes the desired image (e.g. `image:produktdetailbild des autos`). Label always shown in the middle; prefix `image:` is added if missing. Wrapper frame layoutMode NONE so text is overlaid. **Returns:** `{ success: true, placeholderId }`.

### createCard

Frame (card) → addPlaceholderImage (intern) + addText (title) + addText (description, optional) + createButton (CTA, optional). **Returns:** `{ success: true, cardId }`. Use in rows for feature/pricing cards.

### createDivider

createLine (horizontal or vertical; vertical uses rotation 90°) in a wrapper frame, append to parentId. **Returns:** `{ success: true, dividerId }`. Args: parentId, orientation?, length?, strokeWeight?.

### createAvatar

createFrame + createEllipse (circle, neutral fill) + createText (initials, centered). **Returns:** `{ success: true, avatarId }`. Args: parentId, initials, size?.

### createBadge

createFrame + createRectangle (pill cornerRadius) + createText (label). **Returns:** `{ success: true, badgeId }`. Args: parentId, label, variant? (default | primary | success).

### createSpacer

createFrame (width/height, empty) + appendChild(parentId). **Returns:** `{ success: true, spacerId }`. Args: parentId, width?, height?.

### createInput

Frame (vertical) + optional addText (label, small) + createRectangle (stroke, no fill) as field + optional createText (placeholder, caption gray). **Returns:** `{ success: true, inputId }`. Args: parentId, label?, placeholder?.

### createForm

createSection (vertical, spacing normal) + optional addText (title) + createInput for each field in fields[]. **Returns:** `{ success: true, formId }`. Args: parentId, fields: [{ label, placeholder? }], title?.

### createTable

createFrame (table, VERTICAL, itemSpacing 0) + per row createFrame (row, HORIZONTAL) + per cell createFrame + addText. columns/rows limited (max 10×20). **Returns:** `{ success: true, tableId }`. Args: parentId, columns, rows, headerRow?, cellTexts?.

### setLayout (Mutator)

Updates layout of an **existing** Frame (no new node). nodeId must be a frame id (e.g. sectionId, rowId). Optional: layoutMode, itemSpacing, paddingTop/Bottom/Left/Right, primaryAxisAlignItems, counterAxisAlignItems. **Returns:** `{ success: true }` or `{ success: false, error }`.

### createCheckbox

Frame (horizontal) + createRectangle (small box, cornerRadius 4, stroke; fill if checked) + optional addText (label). **Returns:** `{ success: true, checkboxId }`. Args: parentId, label?, checked?.

### createRadio

Frame (horizontal) + createEllipse (small circle, stroke; fill if selected) + optional addText (label). Call multiple times in same section for a radio group. **Returns:** `{ success: true, radioId }`. Args: parentId, label?, selected?.

### createTextarea

Like createInput but taller: Frame (vertical) + optional addText (label) + createRectangle (stroke, height from rows) + optional placeholder text. **Returns:** `{ success: true, textareaId }`. Args: parentId, label?, placeholder?, rows?.

### createList

createFrame (VERTICAL, itemSpacing 6) + per item createFrame (row, HORIZONTAL) with bullet (createEllipse), number (createText "1." …), or nothing; then addText(item). **Returns:** `{ success: true, listId }`. Args: parentId, items: string[], variant?: 'bullet' | 'numbered' | 'plain'.

### createHeader

Horizontal section (createSection direction horizontal) + logo placeholder (createRectangle, optional addText for logoLabel) + addText for each navItem + optional createButton(ctaLabel). **Returns:** `{ success: true, headerId }`. Args: parentId, logoLabel?, navItems?: string[], ctaLabel?, id?.

### createHero

Vertical section (createSection) + addText(title, h1) + optional addText(subtitle) + optional addPlaceholderImage(imageLabel) + optional createButtonRow(ctaLabel). **Returns:** `{ success: true, heroId }`. Args: parentId, title, subtitle?, imageLabel?, ctaLabel?, id?.

### groupNodes (Atom)

Uses `figma.group(nodes, parent, index?)` to group existing nodes under a parent. New GroupNode is stored in nodeMap under groupId; child refs remain in nodeMap. **Returns:** `{ success: true, groupId }` or `{ success: false, error }`. Args: parentId, childIds: string[], id?.

### addSvg

Adds an icon or vector graphic from **raw SVG code**. Uses createSvgNode (figma.createNodeFromSvg) then appendChild to parentId. The agent can write simple SVG (path, circle, rect). Optional width/height to resize the resulting frame. **Returns:** `{ success: true, svgId }`. Args: parentId, svgCode (full SVG string), width?, height?, id?.

### createIconButton

Button with optional **icon (SVG code)** and/or label. Icon-only: square button with centered icon. Icon+label: icon left, label right. Label-only: delegates to createButton. **Returns:** `{ success: true, buttonId }`. Args: parentId, iconSvg?, label?, variant?, iconSize? (default 24), id?.

### executeTool

Dispatcher in `src/agent/execute-tool.ts`: `executeTool(context, toolName, args)` → createSection, createRow, createButton, addText, addPlaceholderImage, createCard, createDivider, createAvatar, createBadge, createSpacer, createInput, createForm, createTable, createButtonRow, setLayout, createCheckbox, createRadio, createTextarea, createList, createHeader, createHero, groupNodes, **addSvg**, **createIconButton**. Returns `ExecuteToolResult<T>`.

## Umgesetzt

- **Mehrspaltigkeit:** createRow – horizontaler Container; createSection(parentId: rowId) mehrfach für Spalten.
- **Mehr Abstand:** createSection hat spacing: compact | normal | spacious; Defaults gap 16, padding 20; Agent nutzt „spacious“.
- **Layout:** createSection/createRow unterstützen align (min | center | max). setLayout ändert bestehende Frames (layoutMode, itemSpacing, padding, Align).
- **Formulare:** createCheckbox, createRadio, createTextarea ergänzen createInput/createForm (Listen, Optionen, mehrzeilige Felder).
- **Listen:** createList für Aufzählungen (bullet, numbered, plain).
- **Optionale Blöcke:** createHeader (Logo + Nav + CTA), createHero (Titel + Subtitle + Bild + CTA), groupNodes (bestehende Nodes gruppieren).
- **Icons/SVG:** addSvg(parentId, svgCode) – Agent kann einfachen SVG-Code schreiben; createIconButton für Icon-Buttons (nur Icon oder Icon+Label). Nutzt figma.createNodeFromSvg im Plugin.

## References

- Architecture: [wireframe-tools-architecture.md](wireframe-tools-architecture.md)
- Atoms: `src/agent/figma-atoms.ts`
- Molecules: `src/agent/figma-molecules.ts`
