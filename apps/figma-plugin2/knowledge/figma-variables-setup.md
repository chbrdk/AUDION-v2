# Figma Variables Setup (Wireframe Plugin)

Generierte Wireframes nutzen **Figma-Variablen**: Ein komplettes Token-Set (Tailwind-inspiriert) wird als Figma-Collection angelegt, alle erstellten Objekte referenzieren diese Variablen wo möglich.

## Token-Set (Tailwind)

- **Quelle:** `src/agent/tailwind-tokens.ts`
  - **Farben:** Slate-Skala (50–950), white, black, semantisch: primary, background, foreground, muted, border, card, avatar, …
  - **Spacing:** 0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96 (in px, 1 = 4px)
  - **Radius:** none, sm, md, lg, xl, 2xl, full
- Variablennamen in Figma sind hyphen-only (z. B. `tw-colors-primary`, `tw-spacing-4`, `tw-radius-md`).

## Ablauf

1. **Vor der Generierung** (`code.ts`): `getOrCreateWireframeVariables()` aufgerufen.
2. **Im Plugin** (`src/figma-variables.ts`):
   - Collection **"Tailwind"** anlegen oder wiederverwenden.
   - Alle Tokens aus `getTailwindTokenList()` als Figma-Variablen anlegen (COLOR / FLOAT), Namen mit Präfix `tw-`.
   - Map zurückgeben: Key = Token-Key (z. B. `colors-primary`, `radius-md`), Value = Figma-Variable.
3. **Beim Generieren**: `context.variables` enthält diese Map. Moleküle übergeben z. B. `fillVariable: context.variables['colors-primary']`, `cornerRadiusVariable: context.variables['radius-md']` an Atome.
4. **In Atomen** (`createRectangle`): Zuerst Literalwerte setzen (Fallback/Tests), dann bei vorhandener Variable binden:
   - Füllfarbe: `figma.variables.setBoundVariableForPaint(paint, 'color', variable)`
   - Eckenradius: `node.setBoundVariable('cornerRadius', variable)`

## Bindung (Referenz in Figma)

Aktuell binden u. a.:
- **createButton:** Fill → `colors-primary` / `colors-secondary`, Corner Radius → `radius-md`

Weitere Bindungen (Card, Header-Logo, Avatar, Input-Border, Divider, …) können analog ergänzt werden: im Molekül `context.variables?.['colors-card']` etc. übergeben, im Atom optionale `strokeVariable` / `fillVariable` / `cornerRadiusVariable` setzen und binden.

## Dateien

- `src/agent/tailwind-tokens.ts` – Vollständiges Token-Set (Tailwind), eine Quelle für Figma + semantische Keys.
- `src/figma-variables.ts` – Sync des Token-Sets in die Figma-Collection „Tailwind“, Rückgabe der Variable-Map.
- `src/agent/figma-atoms.ts` – Optionale Bindung in `createRectangle` (fill, cornerRadius).
- `src/agent/figma-molecules.ts` – `ToolContext.variables`, Übergabe an Atome (z. B. `createButton`).
