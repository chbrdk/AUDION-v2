"use client";

import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import { MsqdxIcon } from "@msqdx/react";

import type { Locale } from "../lib/i18n";
import { sortMoodboardTiles } from "../lib/moodboard";
import { moodboardCategoryMoodLine, shouldShowMoodboardStrip } from "../lib/moodboard-tile-ui";

export type MoodboardDrawerStripTile = {
  id: string;
  category: string;
  imageUrl: string;
  thumbUrl?: string | null;
  caption?: string | null;
  attributionText?: string | null;
  sourceUrl?: string | null;
  order?: number | null;
};

export type MoodboardDrawerStripModel = {
  status?: string;
  styleKeywords?: string[];
  tiles: MoodboardDrawerStripTile[];
};

type Props = {
  moodboard: MoodboardDrawerStripModel | null;
  moodboardError?: string | null;
  locale: Locale;
  t: (key: string, params?: Record<string, string | number>) => string;
  /** Share chat shows moodboard above the thread; admin drawer points to persona admin. */
  hintVariant?: "share" | "admin";
};

const STRIP_MAX = 4;

export function MoodboardPersonaDrawerStrip({ moodboard, moodboardError, locale, t, hintVariant = "share" }: Props) {
  const theme = useTheme();

  if (moodboardError && !moodboard) {
    return (
      <Box
        sx={{
          p: 1.5,
          mb: 1,
          borderRadius: 2,
          border: `1px solid ${alpha(theme.palette.error.main, 0.35)}`,
          backgroundColor: alpha(theme.palette.error.main, 0.06),
        }}
      >
        <Typography variant="caption" sx={{ color: "error.main" }}>
          {moodboardError}
        </Typography>
      </Box>
    );
  }

  if (!shouldShowMoodboardStrip(moodboard)) return null;

  const status = (moodboard!.status ?? "").toLowerCase();
  const tiles = sortMoodboardTiles(moodboard!.tiles ?? []);
  const hasTiles = tiles.length > 0;
  const isBuilding = status === "building";
  const isDraft = status === "draft";
  const isFailed = status === "failed";

  return (
    <Stack spacing={1} sx={{ pb: 2, mb: 0.5, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.9)}` }}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <MsqdxIcon name="image" customSize={18} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {t("chat.moodboardTitle")}
        </Typography>
        {isBuilding || isDraft ? (
          <Stack direction="row" spacing={0.75} alignItems="center">
            <CircularProgress size={12} />
            <Typography variant="caption" sx={{ color: alpha(theme.palette.text.primary, 0.75) }}>
              {isBuilding ? t("chat.moodboardBuilding") : t("chat.moodboardPreparing")}
            </Typography>
          </Stack>
        ) : null}
        {isFailed ? (
          <Typography variant="caption" sx={{ color: "error.main" }}>
            {t("chat.moodboardFailed")}
          </Typography>
        ) : null}
        {moodboardError ? (
          <Typography variant="caption" sx={{ color: "error.main" }}>
            {moodboardError}
          </Typography>
        ) : null}
      </Stack>

      {moodboard!.styleKeywords?.length ? (
        <Typography variant="caption" sx={{ color: alpha(theme.palette.text.primary, 0.72), lineHeight: 1.35 }}>
          {moodboard!.styleKeywords.slice(0, 6).join(" · ")}
        </Typography>
      ) : null}

      {hasTiles ? (
        <Stack direction="row" spacing={1} sx={{ width: "100%", overflowX: "auto", pb: 0.25 }}>
          {tiles.slice(0, STRIP_MAX).map((tile) => (
            <Box
              key={tile.id}
              sx={{
                flex: "1 1 0",
                minWidth: 72,
                maxWidth: 120,
                aspectRatio: "1 / 1",
                borderRadius: 1.5,
                overflow: "hidden",
                position: "relative",
                border: `1px solid ${alpha(theme.palette.divider, 0.65)}`,
                flexShrink: 0,
              }}
            >
              <Box
                component="img"
                src={tile.thumbUrl || tile.imageUrl}
                alt={tile.caption ?? tile.category}
                sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                title={tile.attributionText ?? tile.sourceUrl ?? tile.category}
              />
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "none",
                  background: "linear-gradient(180deg, transparent 45%, rgba(0,0,0,0.65) 100%)",
                }}
              />
              <Box sx={{ position: "absolute", left: 6, right: 6, bottom: 5 }}>
                <Typography
                  variant="caption"
                  sx={{
                    color: "common.white",
                    fontWeight: 700,
                    fontSize: "0.65rem",
                    lineHeight: 1.2,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    textShadow: "0 1px 2px rgba(0,0,0,0.6)",
                  }}
                >
                  {moodboardCategoryMoodLine(tile.category, locale)}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: "rgba(255,255,255,0.92)",
                    fontWeight: 800,
                    fontSize: "0.6rem",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    display: "block",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    textShadow: "0 1px 2px rgba(0,0,0,0.55)",
                  }}
                >
                  {tile.category}
                </Typography>
              </Box>
            </Box>
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" sx={{ color: alpha(theme.palette.text.primary, 0.75) }}>
          {t("chat.moodboardNoTiles")}
        </Typography>
      )}

      {hasTiles ? (
        <Typography variant="caption" sx={{ color: alpha(theme.palette.text.primary, 0.65) }}>
          {hintVariant === "admin" ? t("chat.moodboardDrawerHintAdmin") : t("chat.moodboardDrawerHint")}
        </Typography>
      ) : null}
    </Stack>
  );
}
