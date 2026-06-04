import type { SxProps, Theme } from "@mui/material";

/** Theme accent — use for borders and card titles in TG v2 surfaces. */
export const TG_V2_ACCENT = "var(--color-theme-accent)";

/** CSS classes (see `apps/web/styles/target-group-v2-section-panel.css`). */
export const TG_V2_SURFACE_CLASS = {
  card: "msqdx-tg-v2-surface-card",
  create: "msqdx-tg-v2-surface-create",
  listRow: "msqdx-tg-v2-surface-list-row",
  media: "msqdx-tg-v2-surface-media",
} as const;

export const tgV2SurfaceTitleSx: SxProps<Theme> = {
  "& .MuiTypography-h6": { color: TG_V2_ACCENT },
};

/** Standard content card (personas, documents, knowledge entries, library items). */
export function tgV2CardSurfaceSx(minHeight = 140): SxProps<Theme> {
  return {
    minHeight,
    bgcolor: "transparent",
    ...tgV2SurfaceTitleSx,
  };
}

/** Create / add / upload placement tile. */
export function tgV2CreateSurfaceSx(minHeight = 140): SxProps<Theme> {
  return {
    minHeight,
    bgcolor: "transparent",
    ...tgV2SurfaceTitleSx,
  };
}

/** List row layout (border via CSS class). */
export const tgV2ListRowLayoutSx: SxProps<Theme> = {
  display: "flex",
  alignItems: "center",
  gap: 1.5,
  px: 2,
  py: 1.25,
  cursor: "pointer",
};

export function tgV2ListRowSurfaceSx(minHeight?: number): SxProps<Theme> {
  return {
    ...tgV2ListRowLayoutSx,
    ...(minHeight != null ? { minHeight } : {}),
  };
}

/** Avatar / media band inside cards — subtle fill only here. */
export const tgV2MediaBandSx: SxProps<Theme> = {
  height: 92,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  bgcolor: "rgba(0, 0, 0, 0.03)",
};

/** Basics metadata rail (replaces neutral divider). */
export const tgV2MetadataRailSx: SxProps<Theme> = {
  borderLeft: "1px solid",
  borderColor: TG_V2_ACCENT,
  pl: 2,
};
