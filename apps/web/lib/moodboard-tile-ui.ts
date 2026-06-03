/**
 * Moodboard tile presentation: category-specific overlay copy and responsive grid placement.
 * Keep persona headline/segment in the persona card — overlays here describe the *tile role*.
 *
 * Layout rule: **max 3 columns** from `sm` up so tiles stay large enough to read; `xs` uses 2 columns.
 */

import type { SxProps, Theme } from "@mui/material/styles";

const MOOD_DE: Record<string, string> = {
  lifestyle: "Stimmung, Orte, Alltag",
  places: "Räume, die man betritt",
  colors: "Palette, Licht, Kontrast",
  textures: "Haptik, Material, Oberfläche",
  people: "Typ, Ausstrahlung, Nähe",
  objects: "Dinge mit Bedeutung",
  ui: "Interaktion, Klarheit, Rhythmus",
  typography: "Rhythmus, Stimme, Form",
};

const MOOD_EN: Record<string, string> = {
  lifestyle: "Mood, places, rituals",
  places: "Spaces you would enter",
  colors: "Palette, light, contrast",
  textures: "Touch, materials, surface",
  people: "Character, presence, warmth",
  objects: "Objects with meaning",
  ui: "Interaction, clarity, pace",
  typography: "Rhythm, voice, shape",
};

const CATEGORY_LABEL_DE: Record<string, string> = {
  lifestyle: "Lifestyle",
  places: "Orte",
  colors: "Farben",
  textures: "Texturen",
  people: "Menschen",
  objects: "Objekte",
  ui: "Interface",
  typography: "Typografie",
};

const CATEGORY_LABEL_EN: Record<string, string> = {
  lifestyle: "Lifestyle",
  places: "Places",
  colors: "Colors",
  textures: "Textures",
  people: "People",
  objects: "Objects",
  ui: "Interface",
  typography: "Typography",
};

export type MoodboardCategoryVisual = {
  accent: string;
  accentTint: string;
  glow: string;
  overlay: string;
};

const DEFAULT_CATEGORY_VISUAL: MoodboardCategoryVisual = {
  accent: "var(--color-theme-accent, var(--color-secondary-dx-green))",
  accentTint: "var(--color-theme-accent-tint, var(--color-secondary-dx-green-tint))",
  glow: "rgba(34, 197, 94, 0.28)",
  overlay:
    "linear-gradient(165deg, rgba(0,0,0,0.15) 0%, transparent 40%, rgba(0,0,0,0.78) 100%)",
};

const CATEGORY_VISUALS: Record<string, MoodboardCategoryVisual> = {
  places: {
    accent: "var(--color-secondary-dx-blue)",
    accentTint: "var(--color-secondary-dx-blue-tint)",
    glow: "rgba(59, 130, 246, 0.35)",
    overlay:
      "linear-gradient(158deg, rgba(37,99,235,0.38) 0%, transparent 44%, rgba(0,0,0,0.76) 100%)",
  },
  lifestyle: {
    accent: "var(--color-secondary-dx-orange)",
    accentTint: "var(--color-secondary-dx-orange-tint)",
    glow: "rgba(234, 88, 12, 0.38)",
    overlay:
      "linear-gradient(155deg, rgba(234,88,12,0.42) 0%, transparent 38%, rgba(0,0,0,0.75) 100%)",
  },
  colors: {
    accent: "var(--color-secondary-dx-pink)",
    accentTint: "var(--color-secondary-dx-pink-tint)",
    glow: "rgba(236, 72, 153, 0.35)",
    overlay:
      "linear-gradient(160deg, rgba(236,72,153,0.38) 0%, transparent 42%, rgba(0,0,0,0.72) 100%)",
  },
  textures: {
    accent: "var(--color-secondary-dx-yellow)",
    accentTint: "var(--color-secondary-dx-yellow-tint)",
    glow: "rgba(202, 138, 4, 0.32)",
    overlay:
      "linear-gradient(150deg, rgba(161,98,7,0.35) 0%, transparent 45%, rgba(0,0,0,0.8) 100%)",
  },
  people: {
    accent: "var(--color-secondary-dx-green)",
    accentTint: "var(--color-secondary-dx-green-tint)",
    glow: "rgba(34, 197, 94, 0.32)",
    overlay:
      "linear-gradient(165deg, rgba(22,163,74,0.32) 0%, transparent 40%, rgba(0,0,0,0.78) 100%)",
  },
  objects: {
    accent: "var(--color-secondary-dx-yellow)",
    accentTint: "var(--color-secondary-dx-yellow-tint)",
    glow: "rgba(202, 138, 4, 0.32)",
    overlay:
      "linear-gradient(150deg, rgba(161,98,7,0.34) 0%, transparent 42%, rgba(0,0,0,0.78) 100%)",
  },
  ui: {
    accent: "var(--color-secondary-dx-blue)",
    accentTint: "var(--color-secondary-dx-blue-tint)",
    glow: "rgba(59, 130, 246, 0.35)",
    overlay:
      "linear-gradient(158deg, rgba(37,99,235,0.4) 0%, transparent 44%, rgba(0,0,0,0.76) 100%)",
  },
  typography: {
    accent: "var(--color-secondary-dx-purple)",
    accentTint: "var(--color-secondary-dx-purple-tint)",
    glow: "rgba(124, 58, 237, 0.34)",
    overlay:
      "linear-gradient(162deg, rgba(124,58,237,0.36) 0%, transparent 42%, rgba(0,0,0,0.74) 100%)",
  },
};

function normCategory(category: string): string {
  return category.trim().toLowerCase();
}

/** Accent colors and cinematic overlay per tile category. */
export function moodboardCategoryVisual(category: string): MoodboardCategoryVisual {
  return CATEGORY_VISUALS[normCategory(category)] ?? DEFAULT_CATEGORY_VISUAL;
}

/** Short category title for overlays (not the mood line). */
export function moodboardCategoryDisplayLabel(category: string, locale: "de" | "en" = "de"): string {
  const key = normCategory(category);
  const map = locale === "en" ? CATEGORY_LABEL_EN : CATEGORY_LABEL_DE;
  const raw = category.trim();
  return map[key] ?? (raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : locale === "en" ? "Mood" : "Stimmung");
}

/** Short overlay line for the image (not the persona headline). */
export function moodboardCategoryMoodLine(category: string, locale: "de" | "en" = "de"): string {
  const key = normCategory(category);
  const map = locale === "en" ? MOOD_EN : MOOD_DE;
  return map[key] ?? (locale === "en" ? "Visual inspiration" : "Visuelle Inspiration");
}

/** Shared outer grid: max 3 columns ≥ sm, 2 columns on xs. */
export function moodboardGridContainerSx(opts?: { compact?: boolean; immersive?: boolean }): SxProps<Theme> {
  const compact = Boolean(opts?.compact);
  const immersive = Boolean(opts?.immersive);
  return {
    display: "grid",
    gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)" },
    gridAutoRows: immersive
      ? "minmax(200px, auto)"
      : compact
        ? "minmax(112px, auto)"
        : "minmax(160px, auto)",
    gap: immersive ? { xs: 1.25, sm: 1.75 } : compact ? 1 : 1.5,
  };
}

/** 3-column “bento” for 8 tiles (typical OpenAI): large hero + sidebar + two full rows. */
function bento8ThreeCol(compact: boolean): SxProps<Theme>[] {
  const s = (n: number) => (compact ? Math.round(n * 0.9) : n);
  return [
    { gridColumn: "1 / 3", gridRow: "1 / 3", minHeight: s(300) },
    { gridColumn: "3 / 4", gridRow: "1 / 2", minHeight: s(148) },
    { gridColumn: "3 / 4", gridRow: "2 / 3", minHeight: s(148) },
    { gridColumn: "1 / 2", gridRow: "3 / 4", minHeight: s(168) },
    { gridColumn: "2 / 3", gridRow: "3 / 4", minHeight: s(168) },
    { gridColumn: "3 / 4", gridRow: "3 / 4", minHeight: s(168) },
    { gridColumn: "1 / 2", gridRow: "4 / 5", minHeight: s(168) },
    { gridColumn: "2 / 3", gridRow: "4 / 5", minHeight: s(168) },
  ];
}

/** 2-column layout on xs (8 tiles): wide hero + pairs. */
function bento8TwoCol(compact: boolean): SxProps<Theme>[] {
  const s = (n: number) => (compact ? Math.round(n * 0.9) : n);
  return [
    { gridColumn: "1 / -1", gridRow: "1 / 3", minHeight: s(220) },
    { gridColumn: "span 1", minHeight: s(150) },
    { gridColumn: "span 1", minHeight: s(150) },
    { gridColumn: "span 1", minHeight: s(150) },
    { gridColumn: "span 1", minHeight: s(150) },
    { gridColumn: "span 1", minHeight: s(150) },
    { gridColumn: "span 1", minHeight: s(150) },
    { gridColumn: "span 1", minHeight: s(150) },
  ];
}

/**
 * Per-tile placement inside `moodboardGridContainerSx` (2 cols xs, 3 cols sm+).
 */
export function moodboardTileGridSx(
  index: number,
  total: number,
  opts?: { compact?: boolean; immersive?: boolean }
): SxProps<Theme> {
  const compact = Boolean(opts?.compact);
  const immersive = Boolean(opts?.immersive);
  const scale = immersive ? 1.12 : compact ? 0.92 : 1;
  const s = (n: number) => Math.round(n * scale);

  if (total === 8 && index < 8) {
    const smUp = bento8ThreeCol(compact);
    const xsOnly = bento8TwoCol(compact);
    return {
      xs: xsOnly[index]!,
      sm: smUp[index]!,
    } as SxProps<Theme>;
  }

  if (index === 0) {
    return {
      xs: { gridColumn: "1 / -1", gridRow: "span 2", minHeight: s(240) },
      sm: { gridColumn: "1 / 3", gridRow: "span 2", minHeight: s(300) },
    } as SxProps<Theme>;
  }

  return {
    xs: { gridColumn: "span 1", minHeight: s(150) },
    sm: { gridColumn: "span 1", minHeight: s(170) },
  } as SxProps<Theme>;
}

/** Slight visual rhythm without breaking the glass look. */
export function moodboardTileCardRadius(index: number): number {
  const r = [18, 14, 22, 16, 20, 14, 18, 16];
  return r[index % r.length] ?? 16;
}

/** Same visibility rule as the main chat moodboard preview (tiles or in-progress / error states). */
export function shouldShowMoodboardStrip(moodboard: { status?: string; tiles?: readonly unknown[] } | null): boolean {
  if (!moodboard) return false;
  const status = (moodboard.status ?? "").toLowerCase();
  const hasTiles = (moodboard.tiles?.length ?? 0) > 0;
  return hasTiles || status === "building" || status === "draft" || status === "failed";
}
