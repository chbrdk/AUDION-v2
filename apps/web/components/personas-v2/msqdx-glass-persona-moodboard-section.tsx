"use client";

import { useMemo, type CSSProperties } from "react";
import { Alert, Box, CircularProgress, Tooltip } from "@mui/material";
import { MsqdxButton, MsqdxChip, MsqdxIcon, MsqdxTypography } from "@msqdx/react";
import { MsqdxGlassEditButton } from "../generic/msqdx-glass-edit-button";
import { useI18n } from "../i18n/i18n-provider";
import { sortMoodboardTiles } from "../../lib/moodboard";
import { normalizePaletteSwatches, type MoodboardPaletteSwatch } from "../../lib/moodboard-palette";
import {
  moodboardCategoryDisplayLabel,
  moodboardCategoryMoodLine,
  moodboardCategoryVisual,
  moodboardGridContainerSx,
  moodboardTileCardRadius,
  moodboardTileGridSx,
} from "../../lib/moodboard-tile-ui";

export type PersonaMoodboardTile = {
  id: string;
  moodboardId: string;
  category: string;
  imageUrl: string;
  thumbUrl?: string | null;
  caption?: string | null;
  order: number;
  locked: boolean;
};

export type PersonaMoodboard = {
  id: string;
  status: string;
  styleKeywords?: string[];
  moodManifest?: string | null;
  paletteHints?: string[];
  paletteSwatches?: MoodboardPaletteSwatch[];
  tiles: PersonaMoodboardTile[];
};

export type MsqdxGlassPersonaMoodboardSectionProps = {
  moodboard: PersonaMoodboard | null;
  loading: boolean;
  pending: boolean;
  error: string | null;
  personaHeadline?: string | null;
  onGenerate: () => void;
  onRebuild: () => void;
  onEditTile: (tile: PersonaMoodboardTile) => void;
  onToggleTileLock?: (tile: PersonaMoodboardTile) => void;
  onDeleteTile: (tile: PersonaMoodboardTile) => void;
  canGenerate: boolean;
};

export function MsqdxGlassPersonaMoodboardSection({
  moodboard,
  loading,
  pending,
  error,
  personaHeadline,
  onGenerate,
  onRebuild,
  onEditTile,
  onToggleTileLock,
  onDeleteTile,
  canGenerate,
}: MsqdxGlassPersonaMoodboardSectionProps) {
  const { t, locale } = useI18n();
  const loc = locale === "en" ? "en" : "de";

  const status = (moodboard?.status ?? "").toLowerCase();
  const sortedTiles = useMemo(
    () => (moodboard?.tiles?.length ? sortMoodboardTiles(moodboard.tiles) : []),
    [moodboard?.tiles]
  );
  const paletteSwatches = useMemo(
    () => normalizePaletteSwatches(moodboard?.paletteSwatches),
    [moodboard?.paletteSwatches]
  );
  const isBuilding = pending || status === "building" || status === "draft";
  const hasTiles = sortedTiles.length > 0;
  const gridOpts = { immersive: true as const };

  return (
    <Box
      component="section"
      className="msqdx-glass-moodboard-section"
      aria-labelledby="persona-moodboard-atmosphere-title"
    >
      <Box className="msqdx-glass-moodboard-atmosphere">
        <Box className="msqdx-glass-moodboard-atmosphere__inner">
          <Box className="msqdx-glass-moodboard-atmosphere__copy">
            <MsqdxTypography
              id="persona-moodboard-atmosphere-title"
              variant="h3"
              component="h2"
              className="msqdx-glass-moodboard-atmosphere__title"
            >
              {t("personaV2.moodboard.atmosphereTitle")}
            </MsqdxTypography>
            {moodboard?.moodManifest?.trim() ? (
              <MsqdxTypography variant="body1" className="msqdx-glass-moodboard-atmosphere__manifest">
                {moodboard.moodManifest.trim()}
              </MsqdxTypography>
            ) : (
              <MsqdxTypography variant="body2" className="msqdx-glass-moodboard-atmosphere__lead">
                {personaHeadline?.trim()
                  ? t("personaV2.moodboard.atmosphereLeadWithHeadline", {
                      headline: personaHeadline.trim(),
                    })
                  : t("personaV2.moodboard.atmosphereLead")}
              </MsqdxTypography>
            )}
            {paletteSwatches.length ? (
              <Box className="msqdx-glass-moodboard-swatches" aria-label={t("personaV2.moodboard.paletteFromTiles")}>
                <MsqdxTypography variant="caption" className="msqdx-glass-moodboard-swatches__label">
                  {t("personaV2.moodboard.paletteFromTiles")}
                </MsqdxTypography>
                <Box className="msqdx-glass-moodboard-swatches__row" role="list">
                  {paletteSwatches.map((swatch) => (
                    <Box
                      key={swatch.hex}
                      role="listitem"
                      className="msqdx-glass-moodboard-swatches__dot"
                      title={swatch.hex}
                      sx={{ backgroundColor: swatch.hex }}
                    />
                  ))}
                </Box>
              </Box>
            ) : null}
            {moodboard?.paletteHints?.length ? (
              <Box className="msqdx-glass-moodboard-palette" role="list">
                {moodboard.paletteHints.slice(0, 5).map((hint) => (
                  <MsqdxChip
                    key={hint}
                    label={hint}
                    size="small"
                    variant="outlined"
                    className="msqdx-glass-moodboard-palette__chip"
                  />
                ))}
              </Box>
            ) : null}
            {moodboard?.styleKeywords?.length ? (
              <Box className="msqdx-glass-moodboard-keywords" role="list">
                {moodboard.styleKeywords.slice(0, 8).map((kw) => (
                  <MsqdxChip
                    key={kw}
                    label={kw}
                    size="small"
                    variant="outlined"
                    className="msqdx-glass-moodboard-keywords__chip"
                  />
                ))}
              </Box>
            ) : null}
          </Box>
          <Box className="msqdx-glass-moodboard-atmosphere__toolbar">
            <Box className="msqdx-glass-moodboard-status">
              {isBuilding ? <CircularProgress size={14} aria-hidden /> : null}
              <MsqdxTypography variant="caption" className="msqdx-glass-moodboard-status__label">
                {loading
                  ? t("personaAdmin.loading")
                  : status === "ready"
                    ? t("personaV2.moodboard.statusReady")
                    : status === "failed"
                      ? t("chat.moodboardFailed")
                      : isBuilding
                        ? t("chat.moodboardBuilding")
                        : moodboard
                          ? status
                          : "—"}
              </MsqdxTypography>
            </Box>
            {!moodboard ? (
              <MsqdxButton
                variant="contained"
                size="small"
                brandColor="green"
                onClick={onGenerate}
                disabled={pending || !canGenerate}
                startIcon={<MsqdxIcon name="auto_awesome" customSize={16} />}
              >
                {pending ? t("personaV2.moodboard.generating") : t("personaV2.moodboard.generate")}
              </MsqdxButton>
            ) : (
              <MsqdxButton
                variant="outlined"
                size="small"
                onClick={onRebuild}
                disabled={pending}
                startIcon={<MsqdxIcon name="refresh" customSize={16} />}
              >
                {pending ? t("personaV2.moodboard.generating") : t("personaV2.moodboard.regenerate")}
              </MsqdxButton>
            )}
          </Box>
        </Box>
      </Box>

      {error ? (
        <Alert severity="warning" sx={{ mt: "var(--msqdx-spacing-md)" }}>
          {error}
        </Alert>
      ) : null}

      {hasTiles ? (
        <Box
          className={[
            "msqdx-glass-moodboard-mosaic",
            isBuilding ? "msqdx-glass-moodboard-mosaic--building" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          sx={moodboardGridContainerSx(gridOpts)}
        >
          {sortedTiles.map((tile, index) => {
            const visual = moodboardCategoryVisual(tile.category);
            const isHero = index === 0;
            const tileCount = sortedTiles.length;
            return (
              <Box
                key={tile.id}
                component="article"
                className={[
                  "msqdx-glass-moodboard-tile",
                  isHero ? "msqdx-glass-moodboard-tile--hero" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{ borderRadius: `${moodboardTileCardRadius(index)}px` } as CSSProperties}
                sx={moodboardTileGridSx(index, tileCount, gridOpts)}
              >
                <Box className="msqdx-glass-moodboard-tile__media">
                  <Box
                    component="img"
                    src={tile.thumbUrl || tile.imageUrl}
                    alt={tile.caption ?? moodboardCategoryDisplayLabel(tile.category, loc)}
                    className="msqdx-glass-moodboard-tile__image"
                    loading={index < 3 ? "eager" : "lazy"}
                  />
                  <Box
                    className="msqdx-glass-moodboard-tile__veil"
                    style={{ background: visual.overlay }}
                    aria-hidden
                  />
                  <Box className="msqdx-glass-moodboard-tile__copy">
                    <MsqdxTypography variant="caption" className="msqdx-glass-moodboard-tile__mood">
                      {moodboardCategoryMoodLine(tile.category, loc)}
                    </MsqdxTypography>
                    <MsqdxTypography variant="subtitle2" className="msqdx-glass-moodboard-tile__category">
                      {moodboardCategoryDisplayLabel(tile.category, loc)}
                    </MsqdxTypography>
                    {tile.caption?.trim() ? (
                      <MsqdxTypography variant="body2" className="msqdx-glass-moodboard-tile__caption">
                        {tile.caption.trim()}
                      </MsqdxTypography>
                    ) : null}
                  </Box>
                  <Box className="msqdx-glass-moodboard-tile__actions">
                    {onToggleTileLock ? (
                      <Tooltip
                        title={
                          tile.locked
                            ? t("personaV2.moodboard.unlockTile")
                            : t("personaV2.moodboard.lockTile")
                        }
                      >
                        <span>
                          <MsqdxButton
                            variant="text"
                            size="small"
                            onClick={() => onToggleTileLock(tile)}
                            sx={{ minWidth: 28, width: 28, height: 28, p: 0, borderRadius: "rounded" }}
                            aria-label={
                              tile.locked
                                ? t("personaV2.moodboard.unlockTile")
                                : t("personaV2.moodboard.lockTile")
                            }
                          >
                            <MsqdxIcon name={tile.locked ? "lock" : "lock_open"} customSize={16} />
                          </MsqdxButton>
                        </span>
                      </Tooltip>
                    ) : null}
                    <Tooltip title={t("personaAdmin.edit")}>
                      <span>
                        <MsqdxGlassEditButton onClick={() => onEditTile(tile)} size="small" fontSize={14} />
                      </span>
                    </Tooltip>
                    <Tooltip title={t("personaAdmin.delete")}>
                      <span>
                        <MsqdxButton
                          variant="text"
                          size="small"
                          brandColor="pink"
                          onClick={() => onDeleteTile(tile)}
                          sx={{ minWidth: 28, width: 28, height: 28, p: 0, borderRadius: "rounded" }}
                          aria-label={t("personaAdmin.delete")}
                        >
                          <MsqdxIcon name="delete" customSize={16} />
                        </MsqdxButton>
                      </span>
                    </Tooltip>
                  </Box>
                  {tile.locked ? (
                    <MsqdxChip
                      label={t("personaV2.moodboard.locked")}
                      size="small"
                      className="msqdx-glass-moodboard-tile__locked"
                    />
                  ) : null}
                </Box>
              </Box>
            );
          })}
        </Box>
      ) : moodboard && !loading ? (
        <Box className="msqdx-glass-moodboard-empty">
          <MsqdxIcon name="image" customSize={32} className="msqdx-glass-moodboard-empty__icon" />
          <MsqdxTypography variant="subtitle1" weight="semibold">
            {t("chat.moodboardNoTiles")}
          </MsqdxTypography>
        </Box>
      ) : !moodboard && !loading ? (
        <Box className="msqdx-glass-moodboard-empty">
          <Box className="msqdx-glass-moodboard-empty__preview" aria-hidden>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Box key={i} className="msqdx-glass-moodboard-empty__cell" />
            ))}
          </Box>
          <MsqdxTypography variant="subtitle1" weight="semibold">
            {t("personaV2.moodboard.emptyTitle")}
          </MsqdxTypography>
          <MsqdxTypography variant="body2" className="msqdx-glass-moodboard-empty__body">
            {t("personaV2.moodboard.emptyBody")}
          </MsqdxTypography>
          <MsqdxButton
            variant="contained"
            brandColor="green"
            onClick={onGenerate}
            disabled={pending || !canGenerate}
            startIcon={<MsqdxIcon name="auto_awesome" customSize={18} />}
          >
            {t("personaV2.moodboard.generate")}
          </MsqdxButton>
        </Box>
      ) : null}
    </Box>
  );
}
