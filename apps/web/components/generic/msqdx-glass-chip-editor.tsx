"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Box, useTheme, alpha } from "@mui/material";
import { MsqdxIcon, MsqdxButton, MsqdxTypography, MsqdxInput, MsqdxCornerBox } from "@msqdx/react";
import { MsqdxGlassEditButton, MsqdxGlassAiButtonIcon } from "./";
import { useInlineEdit } from "../hooks/use-inline-edit";
import { MsqdxGlassInlineEditControls } from "../msqdx-glass-inline-edit-controls";
import clsx from "clsx";
import { MsqdxGlassChip, type MsqdxGlassChipVariant } from "./msqdx-glass-chip";
import { MsqdxGlassHorizontalCardSlider } from "./msqdx-glass-horizontal-card-slider";
import { useI18n } from "../i18n/i18n-provider";
import { MONO_FONT_SX, SECTION_HEADING_MONO_SX } from "../../lib/msqdx-typography";
import { INPUT_ACCENT_SX } from "../../lib/theme-accent";
import { MsqdxGlassPainGoalsCornerShell } from "./msqdx-glass-pain-goals-corner-shell";
import {
  resolveChipEditorCornerTabStyle,
  PAIN_GOALS_SLIDE_INDEX_BADGE_RADIUS_PX,
  PAIN_GOALS_SLIDE_INDEX_BADGE_SIZE,
} from "../../lib/chip-editor-corner-tab";

function resolveChipVariant(chipClassName: string): MsqdxGlassChipVariant {
  if (chipClassName.includes("--vocab")) return "vocab";
  if (chipClassName.includes("--pain")) return "pain";
  if (chipClassName.includes("--goal")) return "goal";
  if (chipClassName.includes("--value")) return "value";
  if (chipClassName.includes("--interest")) return "interest";
  if (chipClassName.includes("--social")) return "social";
  if (chipClassName.includes("--trait")) return "trait";
  return "trait";
}

export type MsqdxGlassChipEditorProps = {
  /**
   * Section label (e.g., "Interessen")
   */
  label: string;
  /**
   * Array of chip values
   */
  chips: string[];
  /**
   * CSS class name for chips (e.g., "--dashboard --interest")
   */
  chipClassName?: string;
  /**
   * Callback when chips are saved
   */
  onSave: (chips: string[]) => Promise<void>;
  /**
   * Whether editing is enabled
   */
  editable?: boolean;
  /**
   * Message to show when no chips exist
   */
  emptyMessage?: string;
  /**
   * Optional callback for AI suggestions
   */
  onAiSuggest?: () => Promise<void>;
  /**
   * Whether AI suggestion is loading
   */
  aiLoading?: boolean;
  /**
   * Optional highlighted chips (case-insensitive match)
   */
  highlightedChips?: string[];
  /**
   * `list` — full-width stacked rows; `slider` — carousel; `grid` — fixed columns (e.g. personality).
   * @default 'inline'
   */
  chipLayout?: "inline" | "list" | "slider" | "grid";
  /**
   * Column count when `chipLayout` is `grid`.
   * @default 2
   */
  gridColumns?: 2 | 3;
  /**
   * Visible slides when `chipLayout` is `slider` (supports fractions, e.g. 3.5).
   */
  slidesVisible?: number;
  /**
   * More vertical rhythm between heading and chips.
   */
  relaxedSpacing?: boolean;
  /**
   * Corner tab position when `chipLayout` is `slider` (pain/goal/personality variants).
   * @default 'top-right'
   */
  cornerTabPlacement?: "top-left" | "top-right";
};

export const MsqdxGlassChipEditor = ({
  label,
  chips,
  chipClassName = "",
  onSave,
  editable = true,
  emptyMessage,
  onAiSuggest,
  aiLoading = false,
  highlightedChips = [],
  chipLayout = "inline",
  gridColumns = 2,
  slidesVisible = 3.5,
  relaxedSpacing = false,
  cornerTabPlacement = "top-right",
}: MsqdxGlassChipEditorProps) => {
  const theme = useTheme();
  const { t } = useI18n();
  const displayEmptyMessage = emptyMessage ?? t("chipEditor.emptyEntries");
  const containerRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [newChipValue, setNewChipValue] = useState("");
  const [savePending, setSavePending] = useState(false);
  const editInputWrapperRef = useRef<HTMLDivElement>(null);
  const newInputWrapperRef = useRef<HTMLDivElement>(null);

  // Array comparison function (order-independent for hasChanges)
  const arrayIsEqual = useCallback((a: string[], b: string[]): boolean => {
    if (a.length !== b.length) return false;
    const aSorted = [...a].map(s => s.trim().toLowerCase()).sort();
    const bSorted = [...b].map(s => s.trim().toLowerCase()).sort();
    return JSON.stringify(aSorted) === JSON.stringify(bSorted);
  }, []);

  const chipEdit = useInlineEdit({
    initialValue: chips,
    currentValue: chips,
    isEqual: arrayIsEqual
  });
  const syncChips = chipEdit.sync;

  // Ensure external updates sync when not editing
  useEffect(() => {
    if (!isEditing) {
      syncChips();
    }
  }, [chips, isEditing, syncChips]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && editingIndex === null) {
      const input = newInputWrapperRef.current?.querySelector("input");
      input?.focus();
    }
  }, [isEditing, editingIndex]);

  // Focus edit input when editing a chip
  useEffect(() => {
    if (editingIndex !== null) {
      const input = editInputWrapperRef.current?.querySelector("input");
      input?.focus();
      input?.select();
    }
  }, [editingIndex]);

  const handleStartEdit = () => {
    setIsEditing(true);
    chipEdit.sync(); // Ensure we start with current values
  };

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditingIndex(null);
    setEditingValue("");
    setNewChipValue("");
    chipEdit.reset();
  }, [chipEdit]);

  const handleSave = async () => {
    setSavePending(true);
    try {
      await onSave(chipEdit.value);
      chipEdit.sync();
      setIsEditing(false);
      setEditingIndex(null);
      setEditingValue("");
      setNewChipValue("");
    } catch (error) {
      console.error("Failed to save chips:", error);
    } finally {
      setSavePending(false);
    }
  };

  const handleAddChip = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    // Check for duplicates (case-insensitive)
    const normalized = trimmed.toLowerCase();
    const exists = chipEdit.value.some(chip => chip.trim().toLowerCase() === normalized);
    if (exists) return;

    chipEdit.setValue([...chipEdit.value, trimmed]);
    setNewChipValue("");
  }, [chipEdit]);

  const handleRemoveChip = useCallback((index: number) => {
    chipEdit.setValue(chipEdit.value.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
      setEditingValue("");
    }
  }, [chipEdit, editingIndex]);

  const handleStartEditChip = useCallback((index: number, currentValue: string) => {
    setEditingIndex(index);
    setEditingValue(currentValue);
  }, []);

  const handleSaveEditChip = useCallback(() => {
    if (editingIndex === null) return;

    const trimmed = editingValue.trim();
    if (!trimmed) {
      // Empty value = remove chip
      handleRemoveChip(editingIndex);
      return;
    }

    // Check for duplicates (case-insensitive), but allow if editing same chip
    const normalized = trimmed.toLowerCase();
    const exists = chipEdit.value.some((chip, i) =>
      i !== editingIndex && chip.trim().toLowerCase() === normalized
    );

    if (exists) {
      // Duplicate found, cancel edit
      setEditingIndex(null);
      setEditingValue("");
      return;
    }

    const updated = [...chipEdit.value];
    updated[editingIndex] = trimmed;
    chipEdit.setValue(updated);
    setEditingIndex(null);
    setEditingValue("");
  }, [editingIndex, editingValue, chipEdit, handleRemoveChip]);

  const handleCancelEditChip = useCallback(() => {
    setEditingIndex(null);
    setEditingValue("");
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, isEdit: boolean, index: number | null) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (isEdit && index !== null) {
        handleSaveEditChip();
      } else {
        handleAddChip(newChipValue);
      }
    } else if (e.key === "Escape") {
      if (isEdit && index !== null) {
        handleCancelEditChip();
      } else {
        handleCancelEdit();
      }
    }
  }, [newChipValue, handleAddChip, handleSaveEditChip, handleCancelEditChip, handleCancelEdit]);

  const displayChips = chipEdit.value;
  const hasChips = displayChips.length > 0;
  const showEmptyState = !isEditing && !hasChips;
  const isListLayout = chipLayout === "list";
  const isSliderLayout = chipLayout === "slider";
  const isGridLayout = chipLayout === "grid";
  const isWrapLayout = chipLayout === "inline";
  const usesSectionMono =
    isListLayout || isSliderLayout || isGridLayout || (isWrapLayout && relaxedSpacing);
  const chipVariant = resolveChipVariant(chipClassName);
  const cornerTabStyle = resolveChipEditorCornerTabStyle(chipVariant);
  const useCornerTabChrome = isSliderLayout && Boolean(cornerTabStyle);
  const useCornerTabShell =
    Boolean(cornerTabStyle) && relaxedSpacing && (isWrapLayout || isGridLayout);
  const showHeaderActions = editable && !isEditing && (!isSliderLayout || showEmptyState);

  const sectionHeading =
    label && usesSectionMono ? (
      <Box
        className="msqdx-glass-chip-editor__section-heading"
        sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap", minWidth: 0 }}
      >
        <MsqdxTypography
          variant="h3"
          component="h3"
          weight="thin"
          sx={SECTION_HEADING_MONO_SX}
        >
          {label}
        </MsqdxTypography>
        <MsqdxTypography
          variant="h5"
          component="span"
          sx={{
            ...MONO_FONT_SX,
            fontWeight: 500,
            color: "text.secondary",
            lineHeight: 1.2,
          }}
        >
          {t("chipEditor.entryCount", { count: displayChips.length })}
        </MsqdxTypography>
      </Box>
    ) : null;

  const showSliderInlineHeader =
    isSliderLayout && !showEmptyState && Boolean(sectionHeading) && !useCornerTabChrome;

  const sliderToolbarActions = useMemo(
    () =>
      editable && !isEditing && isSliderLayout && !showEmptyState ? (
        <>
          {onAiSuggest ? (
            <MsqdxGlassAiButtonIcon
              onClick={onAiSuggest}
              disabled={aiLoading}
              loading={aiLoading}
              size="small"
              fontSize={18}
              title={t("chipEditor.aiSuggestion")}
              aria-label={t("chipEditor.aiSuggestion")}
            />
          ) : null}
          {hasChips ? (
            <MsqdxGlassEditButton
              onClick={handleStartEdit}
              size="small"
              fontSize={18}
              aria-label={t("chipEditor.editChips")}
            />
          ) : null}
        </>
      ) : null,
    [
      editable,
      isEditing,
      isSliderLayout,
      showEmptyState,
      onAiSuggest,
      aiLoading,
      hasChips,
      handleStartEdit,
      t,
    ]
  );

  const headerActions = useMemo(
    () =>
      showHeaderActions ? (
        <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
          {onAiSuggest ? (
            <MsqdxGlassAiButtonIcon
              onClick={onAiSuggest}
              disabled={aiLoading}
              loading={aiLoading}
              size="small"
              fontSize={18}
              title={t("chipEditor.aiSuggestion")}
              aria-label={t("chipEditor.aiSuggestion")}
            />
          ) : null}
          {hasChips ? (
            <MsqdxGlassEditButton
              onClick={handleStartEdit}
              size="small"
              fontSize={18}
              aria-label={t("chipEditor.editChips")}
            />
          ) : null}
        </Box>
      ) : null,
    [
      showHeaderActions,
      onAiSuggest,
      aiLoading,
      hasChips,
      handleStartEdit,
      t,
    ]
  );

  const showCornerTabLeadingHeader = useCornerTabShell && Boolean(sectionHeading);
  const showStandaloneHeader =
    !showSliderInlineHeader &&
    !useCornerTabShell &&
    Boolean(label || showHeaderActions);

  const inlineGridBody = (
    <>
      {showEmptyState ? (
        <Box
          sx={{
            color: "text.secondary",
            fontStyle: "italic",
            fontSize: "0.875rem",
            ...(usesSectionMono ? MONO_FONT_SX : {}),
          }}
        >
          {displayEmptyMessage}
        </Box>
      ) : (
        <>
          <Box
            className={clsx(
              "msqdx-glass-chip-editor__chips",
              isGridLayout && "msqdx-glass-chip-editor__chips--grid",
              isGridLayout && gridColumns === 3 && "msqdx-glass-chip-editor__chips--grid-cols-3",
              isWrapLayout && "msqdx-glass-chip-editor__chips--wrap",
              isListLayout && "msqdx-glass-chip-editor__chips--list"
            )}
            sx={{
              display: isGridLayout ? "grid" : "flex",
              flexDirection: isListLayout ? "column" : "row",
              flexWrap: isListLayout ? "nowrap" : isWrapLayout ? "wrap" : "nowrap",
              gridTemplateColumns: isGridLayout
                ? `repeat(${gridColumns}, minmax(0, 1fr))`
                : undefined,
              gap: isGridLayout ? 1.25 : isListLayout ? 1.25 : relaxedSpacing ? 1 : 0.5,
              mb: isEditing ? (relaxedSpacing ? 1.5 : 1) : 0,
              alignItems: isListLayout ? "stretch" : "flex-start",
            }}
          >
            {displayChips.map((chip, idx) => (
              <Box
                key={idx}
                className={isGridLayout ? "msqdx-glass-chip-editor__chip-cell" : undefined}
                sx={{
                  display: "flex",
                  alignItems: isListLayout ? "flex-start" : "center",
                  gap: 0.5,
                  width: isListLayout || isGridLayout ? "100%" : "auto",
                  minWidth: isGridLayout ? 0 : undefined,
                }}
              >
                {isEditing && editingIndex === idx ? (
                  <Box ref={editInputWrapperRef} sx={{ minWidth: "120px" }}>
                    <MsqdxInput
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, true, idx)}
                      onBlur={handleSaveEditChip}
                      size="small"
                      sx={INPUT_ACCENT_SX}
                    />
                  </Box>
                ) : (
                  <MsqdxGlassChip
                    variant={chipVariant}
                    dashboard={true}
                    className={isListLayout ? "--block" : undefined}
                    highlighted={highlightedChips.some(
                      (highlight) => highlight.trim().toLowerCase() === chip.trim().toLowerCase()
                    )}
                    onClick={isEditing ? () => handleStartEditChip(idx, chip) : undefined}
                    style={
                      isListLayout
                        ? { flex: 1, width: "100%" }
                        : isGridLayout
                          ? { width: "100%", maxWidth: "100%", justifyContent: "flex-start" }
                          : undefined
                    }
                  >
                    {chip}
                  </MsqdxGlassChip>
                )}
                {isEditing && editingIndex !== idx && (
                  <MsqdxButton
                    variant="text"
                    size="small"
                    onClick={() => handleRemoveChip(idx)}
                    aria-label={t("common.remove")}
                    sx={{
                      minWidth: 24,
                      minHeight: 24,
                      p: "2px",
                      "&:hover": {
                        backgroundColor: alpha(theme.palette.error.main, 0.1),
                      },
                    }}
                  >
                    <MsqdxIcon name="close" customSize={16} />
                  </MsqdxButton>
                )}
              </Box>
            ))}
            {isEditing && (
              <Box
                ref={newInputWrapperRef}
                className={isGridLayout ? "msqdx-glass-chip-editor__chip-cell" : undefined}
                sx={{
                  minWidth: isListLayout || isGridLayout ? "100%" : "180px",
                  width: isListLayout || isGridLayout ? "100%" : undefined,
                  gridColumn: isGridLayout ? "1 / -1" : undefined,
                }}
              >
                <MsqdxInput
                  value={newChipValue}
                  onChange={(e) => setNewChipValue(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, false, null)}
                  placeholder={t("chipEditor.addEntryPlaceholder")}
                  size="small"
                  sx={INPUT_ACCENT_SX}
                />
              </Box>
            )}
          </Box>

          {isEditing && chipEdit.hasChanges && (
            <MsqdxGlassInlineEditControls
              hasChanges={chipEdit.hasChanges}
              saving={savePending}
              onSave={handleSave}
              onDiscard={handleCancelEdit}
              anchorElement={containerRef.current}
              position="top"
            />
          )}
        </>
      )}
    </>
  );

  return (
    <div
      className={clsx(
        "msqdx-glass-dashboard-card-section",
        isListLayout && "msqdx-glass-chip-editor--list",
        isSliderLayout && "msqdx-glass-chip-editor--slider",
        isGridLayout && "msqdx-glass-chip-editor--grid",
        isGridLayout && gridColumns === 3 && "msqdx-glass-chip-editor--grid-cols-3",
        useCornerTabShell && "msqdx-glass-chip-editor--corner-tab"
      )}
      ref={containerRef}
    >
      {showStandaloneHeader ? (
      <Box
        sx={{
          display: "flex",
          justifyContent: showHeaderActions ? "space-between" : "flex-start",
          alignItems: "center",
          mb:
            isSliderLayout && relaxedSpacing
              ? "-18px"
              : relaxedSpacing
                ? 2
                : 1,
        }}
      >
        {label ? (
          usesSectionMono ? (
            sectionHeading
          ) : (
            <MsqdxTypography
              variant="caption"
              sx={{
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "text.secondary",
              }}
            >
              {label}
            </MsqdxTypography>
          )
        ) : null}
        {headerActions}
      </Box>
      ) : null}

      {isSliderLayout ? (
        <>
          <MsqdxGlassHorizontalCardSlider
            ariaLabel={label}
            slidesVisible={slidesVisible}
            leading={showSliderInlineHeader ? sectionHeading : undefined}
            toolbarStart={sliderToolbarActions}
            renderLayout={
              useCornerTabChrome
                ? ({ controlsEnd, viewport }) => (
                    <MsqdxGlassPainGoalsCornerShell
                      chipVariant={chipVariant}
                      label={label}
                      placement={cornerTabPlacement}
                      tabActions={controlsEnd}
                    >
                      {viewport}
                    </MsqdxGlassPainGoalsCornerShell>
                  )
                : undefined
            }
          >
            {displayChips.map((chip, idx) => (
              <article
                key={idx}
                className="msqdx-glass-horizontal-card-slider__slide"
                data-slide-index={idx}
              >
                <div
                  className={clsx(
                    "msqdx-glass-pain-goals-slide-card",
                    chipVariant === "pain" && "--pain",
                    chipVariant === "goal" && "--goal",
                    useCornerTabChrome && "msqdx-glass-pain-goals-slide-card--indexed"
                  )}
                >
                  <div
                    className={clsx(
                      "msqdx-glass-pain-goals-slide-card__body",
                      useCornerTabChrome && "msqdx-glass-pain-goals-slide-card__body--indexed"
                    )}
                  >
                    {useCornerTabChrome ? (
                      <MsqdxCornerBox
                        className="msqdx-glass-pain-goals-slide-card__index-corner"
                        topLeft="square"
                        topRight="cutdown-a"
                        bottomLeft="cutdown-b"
                        bottomRight="rounded"
                        borderRadius={PAIN_GOALS_SLIDE_INDEX_BADGE_RADIUS_PX}
                        aria-label={t("chipEditor.slideIndexAria", { n: idx + 1 })}
                        sx={{
                          width: PAIN_GOALS_SLIDE_INDEX_BADGE_SIZE,
                          height: PAIN_GOALS_SLIDE_INDEX_BADGE_SIZE,
                          minWidth: PAIN_GOALS_SLIDE_INDEX_BADGE_SIZE,
                          minHeight: PAIN_GOALS_SLIDE_INDEX_BADGE_SIZE,
                          px: 0.75,
                          py: 0.5,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxSizing: "border-box",
                          color: "text.primary",
                          pointerEvents: "none",
                        }}
                      >
                        <Box
                          component="span"
                          sx={{
                            ...MONO_FONT_SX,
                            fontSize: "2.25rem",
                            fontWeight: 300,
                            lineHeight: 1,
                          }}
                        >
                          {idx + 1}
                        </Box>
                      </MsqdxCornerBox>
                    ) : null}
                    {isEditing && editingIndex === idx ? (
                      <Box ref={editInputWrapperRef} sx={{ width: "100%" }}>
                        <MsqdxInput
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, true, idx)}
                          onBlur={handleSaveEditChip}
                          size="small"
                          multiline
                          minRows={3}
                          sx={{ ...INPUT_ACCENT_SX, ...MONO_FONT_SX }}
                        />
                      </Box>
                    ) : (
                      <MsqdxTypography
                        variant="body2"
                        sx={{
                          ...MONO_FONT_SX,
                          lineHeight: 1.55,
                          color: "text.primary",
                          cursor: isEditing ? "pointer" : "default",
                        }}
                        onClick={isEditing ? () => handleStartEditChip(idx, chip) : undefined}
                      >
                        {chip}
                      </MsqdxTypography>
                    )}
                  </div>
                  {isEditing && editingIndex !== idx ? (
                    <MsqdxButton
                      variant="text"
                      size="small"
                      onClick={() => handleRemoveChip(idx)}
                      aria-label={t("common.remove")}
                      className="msqdx-glass-pain-goals-slide-card__remove"
                      sx={{
                        position: "absolute",
                        top: 4,
                        right: 4,
                        minWidth: 24,
                        minHeight: 24,
                        p: "2px",
                        zIndex: 4,
                        "&:hover": {
                          backgroundColor: alpha(theme.palette.error.main, 0.1),
                        },
                      }}
                    >
                      <MsqdxIcon name="close" customSize={16} />
                    </MsqdxButton>
                  ) : null}
                </div>
              </article>
            ))}
            {isEditing ? (
              <article
                className="msqdx-glass-horizontal-card-slider__slide msqdx-glass-horizontal-card-slider__slide--add"
                data-slide-index={displayChips.length}
              >
                <div className="msqdx-glass-pain-goals-slide-card --add">
                  <Box ref={newInputWrapperRef} sx={{ width: "100%" }}>
                    <MsqdxInput
                      value={newChipValue}
                      onChange={(e) => setNewChipValue(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, false, null)}
                      placeholder={t("chipEditor.addEntryPlaceholder")}
                      size="small"
                      multiline
                      minRows={3}
                      sx={{ ...INPUT_ACCENT_SX, ...MONO_FONT_SX }}
                    />
                  </Box>
                </div>
              </article>
            ) : null}
          </MsqdxGlassHorizontalCardSlider>
          {isEditing && chipEdit.hasChanges ? (
            <MsqdxGlassInlineEditControls
              hasChanges={chipEdit.hasChanges}
              saving={savePending}
              onSave={handleSave}
              onDiscard={handleCancelEdit}
              anchorElement={containerRef.current}
              position="top"
            />
          ) : null}
        </>
      ) : (
        <>
          {showCornerTabLeadingHeader ? (
            <Box className="msqdx-glass-chip-editor__corner-tab-leading">{sectionHeading}</Box>
          ) : null}
          {useCornerTabShell ? (
            <MsqdxGlassPainGoalsCornerShell
              chipVariant={chipVariant}
              label={label}
              placement={cornerTabPlacement}
              tabActions={headerActions ?? undefined}
            >
              {inlineGridBody}
            </MsqdxGlassPainGoalsCornerShell>
          ) : (
            inlineGridBody
          )}
        </>
      )}

      {editable && showEmptyState && (
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", mt: 1 }}>
          {onAiSuggest && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <MsqdxGlassAiButtonIcon
                onClick={onAiSuggest}
                disabled={aiLoading}
                loading={aiLoading}
                size="small"
                fontSize={18}
                title={t("chipEditor.aiSuggestion")}
                aria-label={t("chipEditor.aiSuggestion")}
              />
              <Box component="span" sx={{ fontSize: "0.875rem" }}>
                {t("chipEditor.aiSuggestion")}
              </Box>
            </Box>
          )}
          <MsqdxButton
            variant="text"
            size="small"
            onClick={handleStartEdit}
            startIcon={<MsqdxIcon name="add" customSize={18} />}
            aria-label={t("common.add")}
          >
            {t("common.add")}
          </MsqdxButton>
        </Box>
      )}
    </div>
  );
};

