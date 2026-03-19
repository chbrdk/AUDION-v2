# Design Tokens (Wireframe Plugin)

Design tokens are the single source of truth for colors, radius, spacing, typography, and sizing in wireframe generation. They are inspired by shadcn/Radix and ensure all generated Figma nodes stay consistent.

**Location:** `src/agent/design-tokens.ts`

## Structure

- **colors** – RGB (0–1) for background, foreground, primary, secondary, border, input, placeholder, card, avatar, etc. Use `fillFromToken(tokens.colors.xyz)` to get a `SolidFill`.
- **radius** – none, sm (4), md (8), lg (12), xl (16), full.
- **spacing** – 0, 1 (4px), 2 (8), 3 (12), 4 (16), 5 (20), 6 (24), 8 (32), 10 (40), 12 (48), 16 (64).
- **sectionPresets** – compact / normal / spacious (gap + padding). Exported as `SpacingPreset`.
- **typography** – fontFamily (Inter), h1/h2/h3, body, small, caption (fontSize + fontStyle).
- **sizing** – buttonHeight, buttonPaddingX, buttonMinWidth, inputHeight, inputWidth, textarea*, headerHeight, footerHeight, iconSize, logoWidth/Height, checkboxSize, radioSize, avatarSize, tableRowHeight, tableCellPadding, tableCellMinWidth, listItemHeight, listItemSpacing, bulletSize.

## Usage

- **figma-molecules** imports `tokens`, `fillFromToken`, and `SpacingPreset` and uses them for all buttons, inputs, sections, headers, footers, tables, lists, placeholders, typography, etc.
- **figma-atoms** stays low-level and does not import tokens; it receives values from molecules.

## Figma variables (Tailwind set)

The plugin syncs a **full Tailwind-style token set** to Figma and binds generated nodes to it:

1. **Token set:** `src/agent/tailwind-tokens.ts` defines colors (slate scale + semantic), spacing, and radius. All are exported as a flat list with Figma-safe keys (e.g. `colors-primary`, `spacing-4`, `radius-md`).

2. **Sync:** `getOrCreateWireframeVariables()` (in `src/figma-variables.ts`) creates or reuses the collection **"Tailwind"** and creates one Figma variable per token (names prefixed with `tw-`). The returned map keys match the token keys so molecules can pass `context.variables['colors-primary']` etc. to atoms.

3. **Binding:** Generated nodes reference these variables where supported (e.g. **createButton** binds fill and corner radius). Changing a variable in Figma updates all linked nodes. To add bindings, pass the right key from `context.variables` into the atom’s optional `fillVariable` / `cornerRadiusVariable` (and future `strokeVariable`, etc.).

## Extending

To add a new token (e.g. a color or size), add it to the appropriate category in `design-tokens.ts` and use it in the relevant molecule. To expose it as a Figma variable, add it to `figma-variables.ts` (VARIABLE_DEFS + WireframeVariableKey) and bind it in the molecule/atom where needed.
