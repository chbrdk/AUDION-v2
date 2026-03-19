# Figma Design DSL – Architecture Specification

> **Purpose**: This document defines a Domain-Specific Language (DSL) for generating Figma designs programmatically via LLM output. It serves as the complete architectural blueprint for implementation in a Figma plugin (TypeScript, Figma Plugin API).
>
> **Context**: An LLM (Claude API) receives a user prompt like "Create a landing page for an industrial pump company" and responds exclusively in this DSL format. The Figma plugin parses the DSL and renders it into native Figma nodes with Auto Layout, styles, and correct hierarchy.

---

## 1. System Overview

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐     ┌─────────────┐
│  User Prompt │────▶│  Claude API  │────▶│  DSL Output      │────▶│  Figma      │
│  (natural    │     │  (system     │     │  (YAML/JSON)     │     │  Plugin     │
│   language)  │     │   prompt     │     │                  │     │  Converter  │
│              │     │   includes   │     │                  │     │  (renders   │
│              │     │   DSL spec)  │     │                  │     │   nodes)    │
└─────────────┘     └──────────────┘     └──────────────────┘     └─────────────┘
```

### Data Flow

1. User types a design request in the plugin UI (audion chat)
2. Plugin sends prompt to Claude API with DSL spec in system prompt
3. Claude responds with pure DSL (no markdown fences, no explanation)
4. Plugin parses DSL (JSON preferred for reliability, YAML as alternative)
5. Recursive converter walks the DSL tree and creates Figma nodes
6. Final frame is placed on the current Figma page

---

## 2. DSL Format Specification

Use **JSON** as the transport format (not YAML) – it's natively parseable in the plugin sandbox without extra dependencies and eliminates YAML indentation errors from the LLM.

### 2.1 Root Structure

```typescript
interface DSLRoot {
  page: string                    // Name of the design / page title
  width?: number                  // Root frame width in px (default: 1440)
  tokens?: TokenOverrides         // Optional per-design token overrides
  children: DSLNode[]             // Top-level sections
}
```

### 2.2 Node Types (Primitives)

The DSL defines **17 node types** that cover ~95% of landing page and UI patterns. Every node type maps deterministically to Figma API calls.

```typescript
type DSLNode =
  | FrameNode
  | SectionNode
  | TextNode
  | ButtonNode
  | ImageNode
  | IconNode
  | CardNode
  | GridNode
  | StackNode
  | DividerNode
  | InputNode
  | NavbarNode
  | HeroNode
  | FooterNode
  | BadgeNode
  | AvatarNode
  | SpacerNode
```

### 2.3 Complete Node Definitions

```typescript
// ─────────────────────────────────────────────
// LAYOUT PRIMITIVES
// ─────────────────────────────────────────────

interface FrameNode {
  type: "frame"
  name?: string
  layout?: "vertical" | "horizontal" | "none"  // default: "vertical"
  width?: number | "fill" | "hug"              // default: "fill"
  height?: number | "fill" | "hug"             // default: "hug"
  padding?: Padding                             // number | [vertical, horizontal] | [top, right, bottom, left]
  gap?: number                                  // itemSpacing – default: 0
  align?: Alignment                             // cross-axis alignment
  justify?: Justification                       // main-axis alignment
  fill?: Color                                  // background color
  stroke?: StrokeStyle
  cornerRadius?: number | [number, number, number, number]
  opacity?: number                              // 0-1
  clip?: boolean                                // clipsContent – default: false
  effects?: Effect[]
  children?: DSLNode[]
}

interface SectionNode {
  type: "section"
  name?: string
  layout?: "vertical" | "horizontal"            // default: "vertical"
  maxWidth?: number                             // inner content max-width (centers content)
  padding?: Padding                             // default: [80, 24]
  gap?: number                                  // default: 48
  fill?: Color
  align?: Alignment                             // default: "center"
  justify?: Justification
  children?: DSLNode[]
}

interface GridNode {
  type: "grid"
  columns: number                               // 1-6
  gap?: number                                  // default: 24
  children?: DSLNode[]                          // items distributed across columns
}

interface StackNode {
  type: "stack"
  layout: "vertical" | "horizontal"
  gap?: number                                  // default: 16
  align?: Alignment
  justify?: Justification
  wrap?: boolean                                // allows wrapping – default: false
  children?: DSLNode[]
}

interface SpacerNode {
  type: "spacer"
  height?: number                               // default: 32
}

// ─────────────────────────────────────────────
// CONTENT PRIMITIVES
// ─────────────────────────────────────────────

interface TextNode {
  type: "text"
  content: string
  style?: TextStyle                             // references token map – default: "body"
  fill?: Color                                  // text color
  maxWidth?: number                             // text block max width
  align?: "left" | "center" | "right"           // textAlignHorizontal
  lineHeight?: number                           // as multiplier (1.5 = 150%)
  letterSpacing?: number                        // in px
}

interface ImageNode {
  type: "image"
  src?: string                                  // URL or placeholder keyword
  alt?: string                                  // used as Figma node name
  width?: number | "fill"                       // default: "fill"
  height?: number                               // default: 300
  fit?: "cover" | "contain" | "fill"            // default: "cover"
  cornerRadius?: number
}

interface IconNode {
  type: "icon"
  name: string                                  // icon identifier (e.g. "arrow-right", "check")
  size?: number                                 // default: 24
  fill?: Color
}

// ─────────────────────────────────────────────
// COMPONENT PRIMITIVES
// ─────────────────────────────────────────────

interface ButtonNode {
  type: "button"
  label: string
  variant?: "primary" | "secondary" | "outline" | "ghost" | "link"  // default: "primary"
  size?: "sm" | "md" | "lg"                     // default: "md"
  icon?: string                                 // optional icon name (leading)
  iconRight?: string                            // optional icon name (trailing)
  fullWidth?: boolean                           // default: false
}

interface CardNode {
  type: "card"
  padding?: Padding                             // default: 24
  gap?: number                                  // default: 16
  fill?: Color                                  // default: "#FFFFFF"
  stroke?: StrokeStyle
  cornerRadius?: number                         // default: 12
  effects?: Effect[]
  children?: DSLNode[]
}

interface InputNode {
  type: "input"
  label?: string
  placeholder?: string
  inputType?: "text" | "email" | "password" | "textarea" | "select"  // default: "text"
  width?: number | "fill"                       // default: "fill"
}

interface BadgeNode {
  type: "badge"
  label: string
  variant?: "default" | "success" | "warning" | "error" | "info"  // default: "default"
}

interface AvatarNode {
  type: "avatar"
  src?: string
  initials?: string                             // fallback if no image
  size?: number                                 // default: 48
}

interface DividerNode {
  type: "divider"
  color?: Color                                 // default: "#E5E7EB"
  thickness?: number                            // default: 1
}

// ─────────────────────────────────────────────
// COMPOSITE PRIMITIVES (syntactic sugar)
// ─────────────────────────────────────────────

interface NavbarNode {
  type: "navbar"
  logo?: string                                 // text or image reference
  links?: string[]                              // nav link labels
  cta?: string                                  // CTA button label
  fill?: Color                                  // default: "#FFFFFF"
  sticky?: boolean                              // visual indicator only
}

interface HeroNode {
  type: "hero"
  layout?: "center" | "left" | "split"          // default: "center"
  headline: string
  subheadline?: string
  cta?: string                                  // primary CTA label
  ctaSecondary?: string                         // secondary CTA label
  image?: string                                // hero image (for split layout)
  fill?: Color
}

interface FooterNode {
  type: "footer"
  columns?: FooterColumn[]
  copyright?: string
  fill?: Color                                  // default: "#111827"
  textColor?: Color                             // default: "#9CA3AF"
}

interface FooterColumn {
  title: string
  links: string[]
}
```

### 2.4 Shared Type Definitions

```typescript
type Color = string                             // hex "#RRGGBB" or "#RRGGBBAA"

type Padding =
  | number                                      // uniform
  | [number, number]                            // [vertical, horizontal]
  | [number, number, number, number]            // [top, right, bottom, left]

type Alignment = "start" | "center" | "end" | "stretch"
type Justification = "start" | "center" | "end" | "space-between"

type TextStyle =
  | "display"       // 64px bold
  | "heading-xl"    // 48px bold
  | "heading-lg"    // 36px bold
  | "heading-md"    // 28px semibold
  | "heading-sm"    // 22px semibold
  | "body-lg"       // 18px regular
  | "body"          // 16px regular
  | "body-sm"       // 14px regular
  | "caption"       // 12px regular
  | "overline"      // 12px semibold uppercase tracking-wide

interface StrokeStyle {
  color: Color
  width?: number                                // default: 1
  dashPattern?: number[]                        // e.g. [4, 4] for dashed
}

interface Effect {
  type: "drop-shadow" | "inner-shadow" | "blur"
  color?: Color                                 // for shadows
  offset?: { x: number; y: number }             // for shadows
  blur: number
  spread?: number                               // for shadows
}

interface TokenOverrides {
  colors?: Record<string, Color>                // e.g. { "primary": "#0066CC" }
  fonts?: {
    heading?: string                            // font family name
    body?: string
  }
}
```

---

## 3. Design Token System

Tokens allow brand-specific rendering without changing the DSL output. The plugin ships with a default token set, and projects can override tokens.

### 3.1 Default Token Map

```typescript
const DEFAULT_TOKENS: DesignTokens = {
  colors: {
    primary: "#2563EB",
    secondary: "#7C3AED",
    accent: "#F59E0B",
    success: "#10B981",
    warning: "#F59E0B",
    error: "#EF4444",
    info: "#3B82F6",
    background: "#FFFFFF",
    surface: "#F9FAFB",
    text: {
      primary: "#111827",
      secondary: "#6B7280",
      tertiary: "#9CA3AF",
      inverse: "#FFFFFF",
    },
    border: "#E5E7EB",
  },

  typography: {
    "display":     { family: "Inter", style: "Bold",      size: 64, lineHeight: 1.1 },
    "heading-xl":  { family: "Inter", style: "Bold",      size: 48, lineHeight: 1.15 },
    "heading-lg":  { family: "Inter", style: "Bold",      size: 36, lineHeight: 1.2 },
    "heading-md":  { family: "Inter", style: "Semi Bold", size: 28, lineHeight: 1.3 },
    "heading-sm":  { family: "Inter", style: "Semi Bold", size: 22, lineHeight: 1.35 },
    "body-lg":     { family: "Inter", style: "Regular",   size: 18, lineHeight: 1.6 },
    "body":        { family: "Inter", style: "Regular",   size: 16, lineHeight: 1.6 },
    "body-sm":     { family: "Inter", style: "Regular",   size: 14, lineHeight: 1.5 },
    "caption":     { family: "Inter", style: "Regular",   size: 12, lineHeight: 1.5 },
    "overline":    { family: "Inter", style: "Semi Bold", size: 12, lineHeight: 1.5 },
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
    xxxl: 64,
  },

  radii: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },

  shadows: {
    sm:  { color: "#0000000D", offset: { x: 0, y: 1 },  blur: 2,  spread: 0 },
    md:  { color: "#0000001A", offset: { x: 0, y: 4 },  blur: 6,  spread: -1 },
    lg:  { color: "#0000001A", offset: { x: 0, y: 10 }, blur: 15, spread: -3 },
    xl:  { color: "#00000025", offset: { x: 0, y: 20 }, blur: 25, spread: -5 },
  },

  button: {
    primary:   { fill: "$primary",   text: "#FFFFFF",     radius: 8 },
    secondary: { fill: "$secondary", text: "#FFFFFF",     radius: 8 },
    outline:   { fill: "transparent",text: "$primary",    radius: 8, stroke: "$primary" },
    ghost:     { fill: "transparent",text: "$primary",    radius: 8 },
    link:      { fill: "transparent",text: "$primary",    radius: 0, underline: true },
    sizes: {
      sm: { paddingV: 8,  paddingH: 16, fontSize: 14 },
      md: { paddingV: 12, paddingH: 24, fontSize: 16 },
      lg: { paddingV: 16, paddingH: 32, fontSize: 18 },
    },
  },
}
```

### 3.2 Token Resolution

When the DSL contains `$primary` or references like `variant: "primary"`, the converter resolves these against the active token set. Resolution order:

1. **DSL-level overrides** (`tokens` field in root)
2. **Project-level tokens** (stored in plugin settings per Figma project)
3. **Default tokens** (fallback)

```typescript
function resolveColor(value: string, tokens: DesignTokens): RGB {
  if (value.startsWith("$")) {
    const key = value.slice(1)
    const resolved = tokens.colors[key] ?? DEFAULT_TOKENS.colors[key]
    return hexToRgb(resolved)
  }
  return hexToRgb(value)
}
```

---

## 4. Converter Architecture

### 4.1 Module Structure

```
src/
├── plugin/
│   ├── main.ts                  # Plugin entry – receives messages from UI
│   ├── converter/
│   │   ├── index.ts             # Main entry: parseDSL() → renderToFigma()
│   │   ├── parser.ts            # JSON parse + schema validation
│   │   ├── renderer.ts          # Recursive node renderer (DSLNode → Figma node)
│   │   ├── primitives/
│   │   │   ├── frame.ts         # renderFrame()
│   │   │   ├── section.ts       # renderSection()
│   │   │   ├── text.ts          # renderText()
│   │   │   ├── button.ts        # renderButton()
│   │   │   ├── image.ts         # renderImage()
│   │   │   ├── icon.ts          # renderIcon()
│   │   │   ├── card.ts          # renderCard()
│   │   │   ├── grid.ts          # renderGrid()
│   │   │   ├── stack.ts         # renderStack()
│   │   │   ├── divider.ts       # renderDivider()
│   │   │   ├── input.ts         # renderInput()
│   │   │   ├── navbar.ts        # renderNavbar()
│   │   │   ├── hero.ts          # renderHero()
│   │   │   ├── footer.ts        # renderFooter()
│   │   │   ├── badge.ts         # renderBadge()
│   │   │   ├── avatar.ts        # renderAvatar()
│   │   │   └── spacer.ts        # renderSpacer()
│   │   ├── tokens.ts            # Token resolution + default tokens
│   │   ├── fonts.ts             # Font loading + fallback logic
│   │   ├── effects.ts           # Shadow + blur mapping
│   │   └── utils.ts             # Color conversion, padding normalization
│   └── reverse/
│       ├── index.ts             # readFromFigma() → DSL (for iteration)
│       ├── nodeReader.ts        # Figma node → DSLNode mapping
│       └── inferStyles.ts       # Infer text styles from font properties
├── ui/
│   ├── index.html               # Plugin UI shell
│   ├── App.tsx                  # Chat interface (audion)
│   ├── api.ts                   # Claude API client
│   └── systemPrompt.ts         # DSL spec as system prompt for Claude
├── shared/
│   ├── types.ts                 # All DSL type definitions (shared between plugin + UI)
│   └── schema.ts               # JSON Schema for DSL validation (auto-generated from types)
└── tokens/
    ├── default.json             # Default token set
    └── brands/                  # Per-brand token overrides
        ├── ksb.json
        └── porsche.json
```

### 4.2 Core Converter Logic

```typescript
// converter/renderer.ts

import { renderFrame } from "./primitives/frame"
import { renderText } from "./primitives/text"
import { renderButton } from "./primitives/button"
// ... all other primitive imports

type RenderContext = {
  tokens: ResolvedTokens
  parentWidth: number           // needed for "fill" width calculation
  fontCache: Set<string>        // tracks already-loaded fonts
}

/**
 * Main recursive renderer.
 * Takes a DSLNode and returns a Figma SceneNode.
 */
export async function renderNode(
  node: DSLNode,
  ctx: RenderContext
): Promise<SceneNode> {
  switch (node.type) {
    case "frame":     return renderFrame(node, ctx)
    case "section":   return renderSection(node, ctx)
    case "text":      return renderText(node, ctx)
    case "button":    return renderButton(node, ctx)
    case "image":     return renderImage(node, ctx)
    case "icon":      return renderIcon(node, ctx)
    case "card":      return renderCard(node, ctx)
    case "grid":      return renderGrid(node, ctx)
    case "stack":     return renderStack(node, ctx)
    case "divider":   return renderDivider(node, ctx)
    case "input":     return renderInput(node, ctx)
    case "navbar":    return renderNavbar(node, ctx)
    case "hero":      return renderHero(node, ctx)
    case "footer":    return renderFooter(node, ctx)
    case "badge":     return renderBadge(node, ctx)
    case "avatar":    return renderAvatar(node, ctx)
    case "spacer":    return renderSpacer(node, ctx)
    default:
      console.warn(`Unknown node type: ${(node as any).type}`)
      return figma.createFrame() // fallback empty frame
  }
}

/**
 * Renders children into a parent frame.
 * Handles the common pattern of iterating child nodes.
 */
export async function renderChildren(
  children: DSLNode[] | undefined,
  parent: FrameNode,
  ctx: RenderContext
): Promise<void> {
  if (!children?.length) return

  for (const child of children) {
    const rendered = await renderNode(child, ctx)
    parent.appendChild(rendered)
  }
}
```

### 4.3 Primitive Renderer Example: Section

```typescript
// converter/primitives/section.ts

export async function renderSection(
  node: SectionNode,
  ctx: RenderContext
): Promise<FrameNode> {
  // Outer frame (full width, handles background)
  const outer = figma.createFrame()
  outer.name = node.name ?? "Section"
  outer.layoutMode = "VERTICAL"
  outer.primaryAxisSizingMode = "AUTO"       // hug content height
  outer.counterAxisSizingMode = "FIXED"      // fill parent width
  outer.resize(ctx.parentWidth, 100)         // initial width, height auto-adjusts

  // Alignment
  outer.counterAxisAlignItems = mapAlignment(node.align ?? "center")
  if (node.justify) {
    outer.primaryAxisAlignItems = mapJustification(node.justify)
  }

  // Padding
  const [pt, pr, pb, pl] = normalizePadding(node.padding ?? [80, 24])
  outer.paddingTop = pt
  outer.paddingRight = pr
  outer.paddingBottom = pb
  outer.paddingLeft = pl

  // Gap
  outer.itemSpacing = node.gap ?? 48

  // Fill
  if (node.fill) {
    outer.fills = [{ type: "SOLID", color: hexToRgb(node.fill) }]
  } else {
    outer.fills = []
  }

  // If maxWidth is set, create an inner constraining frame
  if (node.maxWidth) {
    const inner = figma.createFrame()
    inner.name = "Content"
    inner.layoutMode = outer.layoutMode
    inner.primaryAxisSizingMode = "AUTO"
    inner.counterAxisSizingMode = "FIXED"
    inner.resize(Math.min(node.maxWidth, ctx.parentWidth), 100)
    inner.itemSpacing = outer.itemSpacing
    inner.fills = []

    await renderChildren(node.children, inner, {
      ...ctx,
      parentWidth: node.maxWidth,
    })

    outer.appendChild(inner)
  } else {
    await renderChildren(node.children, outer, ctx)
  }

  return outer
}
```

### 4.4 Composite Primitive Example: Hero

Composite primitives are syntactic sugar. They internally expand into basic primitives:

```typescript
// converter/primitives/hero.ts

export async function renderHero(
  node: HeroNode,
  ctx: RenderContext
): Promise<FrameNode> {
  // Hero "center" layout expands to:
  // section > stack(vertical, center-aligned) > [headline, subheadline, button-row]

  const section: SectionNode = {
    type: "section",
    name: "Hero",
    layout: "vertical",
    align: "center",
    padding: [120, 24],
    gap: 24,
    fill: node.fill,
    children: [],
  }

  // Headline
  section.children!.push({
    type: "text",
    content: node.headline,
    style: "display",
    align: "center",
    fill: node.fill ? "#FFFFFF" : undefined,  // assume light text on colored bg
  })

  // Subheadline
  if (node.subheadline) {
    section.children!.push({
      type: "text",
      content: node.subheadline,
      style: "body-lg",
      align: "center",
      maxWidth: 640,
      fill: node.fill ? "#FFFFFFCC" : undefined,
    })
  }

  // CTA buttons
  if (node.cta || node.ctaSecondary) {
    const buttonRow: StackNode = {
      type: "stack",
      layout: "horizontal",
      gap: 16,
      align: "center",
      children: [],
    }
    if (node.cta) {
      buttonRow.children!.push({
        type: "button",
        label: node.cta,
        variant: "primary",
        size: "lg",
      })
    }
    if (node.ctaSecondary) {
      buttonRow.children!.push({
        type: "button",
        label: node.ctaSecondary,
        variant: "outline",
        size: "lg",
      })
    }
    section.children!.push(buttonRow)
  }

  // For "split" layout: wrap in horizontal stack with image
  if (node.layout === "split" && node.image) {
    const splitSection: SectionNode = {
      type: "section",
      name: "Hero",
      layout: "horizontal",
      padding: [80, 24],
      gap: 48,
      fill: node.fill,
      children: [
        {
          type: "stack",
          layout: "vertical",
          gap: 24,
          align: "start",
          justify: "center",
          children: section.children!,
        },
        {
          type: "image",
          src: node.image,
          width: "fill",
          height: 500,
          cornerRadius: 12,
        },
      ],
    }
    return renderSection(splitSection, ctx)
  }

  return renderSection(section, ctx)
}
```

---

## 5. Font Loading Strategy

Fonts must be loaded before any text node is created. The Figma Plugin API requires `figma.loadFontAsync()` for every font/style combination used.

```typescript
// converter/fonts.ts

const fontCache = new Set<string>()

export async function ensureFont(
  family: string,
  style: string
): Promise<FontName> {
  const key = `${family}::${style}`

  if (!fontCache.has(key)) {
    try {
      await figma.loadFontAsync({ family, style })
      fontCache.add(key)
    } catch {
      // Fallback chain
      const fallbacks: FontName[] = [
        { family: "Inter", style },
        { family: "Inter", style: "Regular" },
        { family: "Roboto", style: "Regular" },
      ]
      for (const fb of fallbacks) {
        try {
          await figma.loadFontAsync(fb)
          fontCache.add(key)
          return fb
        } catch {
          continue
        }
      }
      // Last resort
      const defaultFont: FontName = { family: "Inter", style: "Regular" }
      await figma.loadFontAsync(defaultFont)
      fontCache.add(key)
      return defaultFont
    }
  }

  return { family, style }
}

/**
 * Pre-load all fonts referenced in a DSL tree before rendering.
 * This avoids async issues during the render pass.
 */
export async function preloadFontsForDSL(
  root: DSLRoot,
  tokens: ResolvedTokens
): Promise<void> {
  const styles = collectTextStyles(root)    // walk tree, collect all TextStyle refs
  const uniqueFonts = new Set<string>()

  for (const style of styles) {
    const typo = tokens.typography[style]
    if (typo) {
      uniqueFonts.add(`${typo.family}::${typo.style}`)
    }
  }

  await Promise.all(
    [...uniqueFonts].map(key => {
      const [family, style] = key.split("::")
      return ensureFont(family, style)
    })
  )
}
```

---

## 6. Reverse Conversion (Figma → DSL)

For iteration support ("make the hero bigger"), the plugin needs to read existing Figma nodes back into DSL format.

```typescript
// reverse/nodeReader.ts

export function figmaNodeToDSL(node: SceneNode): DSLNode | null {
  if (node.type === "TEXT") {
    return {
      type: "text",
      content: node.characters,
      fill: extractFillColor(node),
      align: mapTextAlign(node.textAlignHorizontal),
      // Infer style from fontSize + fontWeight
      style: inferTextStyle(node),
    }
  }

  if (node.type === "FRAME" || node.type === "COMPONENT" || node.type === "INSTANCE") {
    const children = node.children
      .map(child => figmaNodeToDSL(child))
      .filter(Boolean) as DSLNode[]

    return {
      type: "frame",
      name: node.name,
      layout: node.layoutMode === "HORIZONTAL" ? "horizontal"
            : node.layoutMode === "VERTICAL" ? "vertical"
            : "none",
      width: node.width,
      height: node.height,
      padding: [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft],
      gap: node.itemSpacing,
      fill: extractFillColor(node),
      cornerRadius: extractCornerRadius(node),
      children,
    }
  }

  if (node.type === "RECTANGLE") {
    return {
      type: "frame",
      name: node.name,
      width: node.width,
      height: node.height,
      fill: extractFillColor(node),
      cornerRadius: extractCornerRadius(node),
    }
  }

  return null
}
```

### Iteration Flow

```
1. User: "Make the hero section darker and add a third CTA"
2. Plugin reads current page selection → figmaNodeToDSL() → current DSL
3. Plugin sends to Claude:
   - System: DSL spec
   - User: "Current design:\n{currentDSL}\n\nModification: Make the hero section darker and add a third CTA"
4. Claude returns modified DSL
5. Plugin removes old nodes, renders new DSL
```

---

## 7. Image Handling

Since the LLM cannot generate actual images, the DSL uses **placeholders** that the converter handles:

```typescript
// converter/primitives/image.ts

export async function renderImage(
  node: ImageNode,
  ctx: RenderContext
): Promise<FrameNode> {
  const frame = figma.createFrame()
  frame.name = node.alt ?? "Image"

  // Size
  const width = node.width === "fill" ? ctx.parentWidth : (node.width ?? ctx.parentWidth)
  const height = node.height ?? 300
  frame.resize(width, height)

  if (node.cornerRadius) {
    frame.cornerRadius = node.cornerRadius
  }
  frame.clipsContent = true

  // Placeholder rendering: gray bg with icon
  frame.fills = [{ type: "SOLID", color: hexToRgb("#F3F4F6") }]

  // Add placeholder icon (mountain/image icon)
  const icon = figma.createText()
  await ensureFont("Inter", "Regular")
  icon.characters = "🖼"
  icon.fontSize = Math.min(width, height) * 0.15
  frame.appendChild(icon)

  // Center the icon
  frame.layoutMode = "VERTICAL"
  frame.primaryAxisAlignItems = "CENTER"
  frame.counterAxisAlignItems = "CENTER"
  frame.primaryAxisSizingMode = "FIXED"
  frame.counterAxisSizingMode = "FIXED"

  // If src is a URL, attempt to fetch and fill
  if (node.src && node.src.startsWith("http")) {
    try {
      const imageData = await fetchImageAsBytes(node.src)
      const imgHash = figma.createImage(imageData).hash
      frame.fills = [{
        type: "IMAGE",
        imageHash: imgHash,
        scaleMode: node.fit === "contain" ? "FIT" : "FILL",
      }]
      icon.remove()
    } catch {
      // Keep placeholder on fetch failure
    }
  }

  return frame
}
```

---

## 8. LLM System Prompt Template

This is the system prompt sent to Claude API to ensure DSL-only output:

```typescript
// ui/systemPrompt.ts

export function buildSystemPrompt(tokens?: DesignTokens): string {
  return `You are a UI design generator. You respond ONLY with valid JSON conforming to the Figma DSL specification below. No markdown, no explanation, no code fences. Only raw JSON.

## DSL Specification

${DSL_SCHEMA_AS_TEXT}

## Active Design Tokens

${JSON.stringify(tokens ?? DEFAULT_TOKENS, null, 2)}

## Rules

1. Respond with a single JSON object matching the DSLRoot schema.
2. Use semantic section names (e.g. "Hero", "Features", "Testimonials", "CTA", "Footer").
3. Use the token system: reference text styles by name ("heading-xl", "body", etc.), use token colors where appropriate.
4. Design for ${tokens?.meta?.width ?? 1440}px width.
5. Ensure visual hierarchy: clear heading sizes, consistent spacing, proper contrast.
6. Use "section" nodes for major page areas with appropriate padding.
7. Use "grid" for multi-column layouts.
8. Use "card" for repeated content items.
9. Use composite primitives ("hero", "navbar", "footer") when they match the intent.
10. Every text node must have actual realistic placeholder content, not "Lorem ipsum".
11. Ensure accessibility: sufficient color contrast, logical reading order.
12. If a brand or company is mentioned, adapt colors and content to match that brand.`
}
```

---

## 9. Plugin Entry Point

```typescript
// plugin/main.ts

import { parseDSL } from "./converter/parser"
import { renderNode, renderChildren } from "./converter/renderer"
import { resolveTokens } from "./converter/tokens"
import { preloadFontsForDSL } from "./converter/fonts"

figma.showUI(__html__, { width: 400, height: 600 })

figma.ui.onmessage = async (msg) => {
  if (msg.type === "generate-design") {
    const { dslJson, tokenOverrides } = msg

    try {
      // 1. Parse and validate
      const dsl = parseDSL(dslJson)

      // 2. Resolve tokens
      const tokens = resolveTokens(dsl.tokens, tokenOverrides)

      // 3. Pre-load all fonts
      await preloadFontsForDSL(dsl, tokens)

      // 4. Create root frame
      const root = figma.createFrame()
      root.name = dsl.page ?? "Generated Design"
      root.layoutMode = "VERTICAL"
      root.primaryAxisSizingMode = "AUTO"
      root.counterAxisSizingMode = "FIXED"
      root.resize(dsl.width ?? 1440, 100)
      root.fills = [{ type: "SOLID", color: hexToRgb("#FFFFFF") }]

      // 5. Render all children
      const ctx: RenderContext = {
        tokens,
        parentWidth: dsl.width ?? 1440,
        fontCache: new Set(),
      }

      await renderChildren(dsl.children, root, ctx)

      // 6. Position on canvas
      const viewport = figma.viewport.center
      root.x = viewport.x - root.width / 2
      root.y = viewport.y - root.height / 2

      // 7. Focus
      figma.viewport.scrollAndZoomIntoView([root])

      figma.ui.postMessage({ type: "generate-success" })
    } catch (error) {
      figma.ui.postMessage({
        type: "generate-error",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  if (msg.type === "read-selection") {
    const selection = figma.currentPage.selection
    if (selection.length === 0) {
      figma.ui.postMessage({ type: "selection-empty" })
      return
    }
    const dsl = figmaNodeToDSL(selection[0])
    figma.ui.postMessage({ type: "selection-dsl", dsl })
  }
}
```

---

## 10. Error Handling & Validation

```typescript
// converter/parser.ts

import Ajv from "ajv"
import dslSchema from "../shared/schema.json"

const ajv = new Ajv({ allErrors: true })
const validate = ajv.compile(dslSchema)

export function parseDSL(input: string): DSLRoot {
  let parsed: unknown

  // 1. Strip potential markdown fences (LLM safety net)
  const cleaned = input
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim()

  // 2. Parse JSON
  try {
    parsed = JSON.parse(cleaned)
  } catch (e) {
    throw new DSLParseError(`Invalid JSON: ${(e as Error).message}`)
  }

  // 3. Validate against schema
  if (!validate(parsed)) {
    const errors = validate.errors?.map(e => `${e.instancePath}: ${e.message}`).join("; ")
    throw new DSLValidationError(`DSL validation failed: ${errors}`)
  }

  return parsed as DSLRoot
}

class DSLParseError extends Error {
  name = "DSLParseError"
}

class DSLValidationError extends Error {
  name = "DSLValidationError"
}
```

---

## 11. Utility Functions

```typescript
// converter/utils.ts

export function hexToRgb(hex: string): RGB {
  const clean = hex.replace("#", "")
  const r = parseInt(clean.slice(0, 2), 16) / 255
  const g = parseInt(clean.slice(2, 4), 16) / 255
  const b = parseInt(clean.slice(4, 6), 16) / 255
  return { r, g, b }
}

export function hexToRgba(hex: string): { color: RGB; opacity: number } {
  const clean = hex.replace("#", "")
  const rgb = hexToRgb(hex)
  const opacity = clean.length === 8
    ? parseInt(clean.slice(6, 8), 16) / 255
    : 1
  return { color: rgb, opacity }
}

export function normalizePadding(
  p: number | [number, number] | [number, number, number, number]
): [number, number, number, number] {
  if (typeof p === "number") return [p, p, p, p]
  if (p.length === 2) return [p[0], p[1], p[0], p[1]]
  return p
}

export function mapAlignment(a: Alignment): "MIN" | "CENTER" | "MAX" | "STRETCH" {
  switch (a) {
    case "start":   return "MIN"
    case "center":  return "CENTER"
    case "end":     return "MAX"
    case "stretch": return "STRETCH"
  }
}

export function mapJustification(j: Justification): "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN" {
  switch (j) {
    case "start":         return "MIN"
    case "center":        return "CENTER"
    case "end":           return "MAX"
    case "space-between": return "SPACE_BETWEEN"
  }
}
```

---

## 12. Implementation Priorities

### Phase 1 – Minimum Viable Converter
1. `frame`, `section`, `text`, `button`, `image`, `spacer`, `divider`
2. Default token set with Inter font
3. Basic JSON parsing (no schema validation yet)
4. Manual DSL input (paste JSON into plugin UI)

### Phase 2 – LLM Integration
5. Claude API integration in plugin UI
6. System prompt with DSL spec
7. End-to-end: prompt → DSL → Figma nodes
8. Error handling + retry on malformed output

### Phase 3 – Composite Primitives
9. `navbar`, `hero`, `footer`, `card`, `grid`
10. `input`, `badge`, `avatar`
11. `icon` (simple shape-based icons or emoji fallback)

### Phase 4 – Iteration & Polish
12. Reverse converter (Figma → DSL)
13. Selection-aware editing ("modify selected frame")
14. Brand token presets
15. Schema validation with helpful error messages

**Renderer behavior (layout & visuals):**
- **Section, Grid, Card, Stack**: Height hugs content (`resize(width, 0)` + `primaryAxisSizingMode`/`counterAxisSizingMode` AUTO where applicable) so columns and teasers are not clipped to 100px.
- **Hero**: Renders image placeholder when `image` (URL string) is set; supports `layout: "split"` (two columns: text + image). Center layout stacks headline, subheadline, CTA, then image below.
- **Image**: Placeholder shows icon + label (alt or truncated `src`); light fill and stroke so it reads as “image area”.
- **Card**: Default 1px border (`#E5E7EB`) and subtle drop shadow for teaser-style blocks.

### Phase 5 – Advanced
16. Figma Component generation (create reusable components)
17. Responsive variants (desktop/tablet/mobile frames)
18. Figma Styles integration (create/use shared color + text styles)
19. Export DSL as reusable template