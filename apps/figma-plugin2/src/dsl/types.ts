/**
 * Figma Design DSL – type definitions (see knowledge/figma-dsl.md).
 * Prefix "DSL" for node types to avoid conflict with Figma plugin API types.
 */

export type Color = string; // hex "#RRGGBB" or "#RRGGBBAA"

export type Padding =
  | number
  | [number, number]
  | [number, number, number, number];

export type Alignment = 'start' | 'center' | 'end' | 'stretch';
export type Justification = 'start' | 'center' | 'end' | 'space-between';

export type TextStyle =
  | 'display'
  | 'heading-xl'
  | 'heading-lg'
  | 'heading-md'
  | 'heading-sm'
  | 'body-lg'
  | 'body'
  | 'body-sm'
  | 'caption'
  | 'overline';

export interface StrokeStyle {
  color: Color;
  width?: number;
  dashPattern?: number[];
}

export interface Effect {
  type: 'drop-shadow' | 'inner-shadow' | 'blur';
  color?: Color;
  offset?: { x: number; y: number };
  blur: number;
  spread?: number;
}

export interface TokenOverrides {
  colors?: Record<string, Color>;
  fonts?: { heading?: string; body?: string };
}

export interface FooterColumn {
  title: string;
  links: string[];
}

// ─────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────

export interface DSLRoot {
  page: string;
  width?: number;
  tokens?: TokenOverrides;
  children: DSLNode[];
}

// ─────────────────────────────────────────────
// LAYOUT PRIMITIVES
// ─────────────────────────────────────────────

export interface DSLFrame {
  type: 'frame';
  name?: string;
  layout?: 'vertical' | 'horizontal' | 'none';
  width?: number | 'fill' | 'hug';
  height?: number | 'fill' | 'hug';
  padding?: Padding;
  gap?: number;
  align?: Alignment;
  justify?: Justification;
  fill?: Color;
  stroke?: StrokeStyle;
  cornerRadius?: number | [number, number, number, number];
  opacity?: number;
  clip?: boolean;
  effects?: Effect[];
  children?: DSLNode[];
}

export interface DSLSection {
  type: 'section';
  name?: string;
  layout?: 'vertical' | 'horizontal';
  maxWidth?: number;
  padding?: Padding;
  gap?: number;
  fill?: Color;
  align?: Alignment;
  justify?: Justification;
  children?: DSLNode[];
}

export interface DSLGrid {
  type: 'grid';
  columns: number;
  gap?: number;
  children?: DSLNode[];
}

export interface DSLStack {
  type: 'stack';
  layout: 'vertical' | 'horizontal';
  gap?: number;
  align?: Alignment;
  justify?: Justification;
  wrap?: boolean;
  children?: DSLNode[];
}

export interface DSLSpacer {
  type: 'spacer';
  height?: number;
}

// ─────────────────────────────────────────────
// CONTENT PRIMITIVES
// ─────────────────────────────────────────────

export interface DSLText {
  type: 'text';
  content: string;
  style?: TextStyle;
  fill?: Color;
  maxWidth?: number;
  align?: 'left' | 'center' | 'right';
  lineHeight?: number;
  letterSpacing?: number;
}

export interface DSLImage {
  type: 'image';
  src?: string;
  alt?: string;
  width?: number | 'fill';
  height?: number;
  fit?: 'cover' | 'contain' | 'fill';
  cornerRadius?: number;
}

export interface DSLIcon {
  type: 'icon';
  name: string;
  size?: number;
  fill?: Color;
}

// ─────────────────────────────────────────────
// COMPONENT PRIMITIVES
// ─────────────────────────────────────────────

export interface DSLButton {
  type: 'button';
  label: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'link';
  size?: 'sm' | 'md' | 'lg';
  icon?: string;
  iconRight?: string;
  fullWidth?: boolean;
}

export interface DSLCard {
  type: 'card';
  padding?: Padding;
  gap?: number;
  fill?: Color;
  stroke?: StrokeStyle;
  cornerRadius?: number;
  effects?: Effect[];
  children?: DSLNode[];
}

export interface DSLInput {
  type: 'input';
  label?: string;
  placeholder?: string;
  inputType?: 'text' | 'email' | 'password' | 'textarea' | 'select';
  width?: number | 'fill';
}

export interface DSLBadge {
  type: 'badge';
  label: string;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
}

export interface DSLAvatar {
  type: 'avatar';
  src?: string;
  initials?: string;
  size?: number;
}

export interface DSLDivider {
  type: 'divider';
  color?: Color;
  thickness?: number;
}

// ─────────────────────────────────────────────
// COMPOSITE PRIMITIVES
// ─────────────────────────────────────────────

export interface DSLNavbar {
  type: 'navbar';
  logo?: string;
  links?: string[];
  cta?: string;
  fill?: Color;
  sticky?: boolean;
}

export interface DSLHero {
  type: 'hero';
  layout?: 'center' | 'left' | 'split';
  headline: string;
  subheadline?: string;
  cta?: string;
  ctaSecondary?: string;
  image?: string;
  fill?: Color;
}

export interface DSLFooter {
  type: 'footer';
  columns?: FooterColumn[];
  copyright?: string;
  fill?: Color;
  textColor?: Color;
}

// ─────────────────────────────────────────────
// UNION
// ─────────────────────────────────────────────

export type DSLNode =
  | DSLFrame
  | DSLSection
  | DSLText
  | DSLButton
  | DSLImage
  | DSLIcon
  | DSLCard
  | DSLGrid
  | DSLStack
  | DSLDivider
  | DSLInput
  | DSLNavbar
  | DSLHero
  | DSLFooter
  | DSLBadge
  | DSLAvatar
  | DSLSpacer;
