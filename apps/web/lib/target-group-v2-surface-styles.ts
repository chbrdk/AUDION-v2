/** Theme accent — use for borders and card titles in TG v2 surfaces. */
export const TG_V2_ACCENT = "var(--color-theme-accent)";

/** CSS classes (see `apps/web/styles/target-group-v2-section-panel.css`). */
export const TG_V2_SURFACE_CLASS = {
  card: "msqdx-tg-v2-surface-card",
  create: "msqdx-tg-v2-surface-create",
  listRow: "msqdx-tg-v2-surface-list-row",
  media: "msqdx-tg-v2-surface-media",
} as const;

const tgV2SurfaceTitleStyles = {
  "& .MuiTypography-h6": { color: TG_V2_ACCENT },
} as const;

/** Standard content card (personas, documents, knowledge entries, library items). */
export function tgV2CardSurfaceSx(minHeight = 140) {
  return {
    minHeight,
    bgcolor: "transparent",
    ...tgV2SurfaceTitleStyles,
  };
}

/** Create / add / upload placement tile. */
export function tgV2CreateSurfaceSx(minHeight = 140) {
  return {
    minHeight,
    bgcolor: "transparent",
    ...tgV2SurfaceTitleStyles,
  };
}

/** List row layout (border via CSS class). */
export const tgV2ListRowLayoutSx = {
  display: "flex",
  alignItems: "center",
  gap: 1.5,
  px: 2,
  py: 1.25,
  cursor: "pointer",
} as const;

export function tgV2ListRowSurfaceSx(minHeight?: number) {
  return {
    ...tgV2ListRowLayoutSx,
    ...(minHeight != null ? { minHeight } : {}),
  };
}

/** Avatar / media band inside cards — subtle fill only here. */
export const tgV2MediaBandSx = {
  height: 92,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  bgcolor: "rgba(0, 0, 0, 0.03)",
} as const;

/** Basics metadata rail (replaces neutral divider). */
export const tgV2MetadataRailSx = {
  borderLeft: "1px solid",
  borderColor: TG_V2_ACCENT,
  pl: 2,
} as const;
