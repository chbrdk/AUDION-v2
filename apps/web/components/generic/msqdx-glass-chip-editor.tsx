"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Box, useTheme, alpha } from "@mui/material";
import { MsqdxIcon, MsqdxButton, MsqdxTypography, MsqdxInput } from "@msqdx/react";
import { MsqdxGlassEditButton, MsqdxGlassAiButtonIcon } from "./";
import { useInlineEdit } from "../hooks/use-inline-edit";
import { MsqdxGlassInlineEditControls } from "../msqdx-glass-inline-edit-controls";
import { MsqdxGlassChip } from "./msqdx-glass-chip";
import { INPUT_ACCENT_SX } from "../../lib/theme-accent";

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
};

export const MsqdxGlassChipEditor = ({
  label,
  chips,
  chipClassName = "",
  onSave,
  editable = true,
  emptyMessage = "Keine Einträge",
  onAiSuggest,
  aiLoading = false,
  highlightedChips = []
}: MsqdxGlassChipEditorProps) => {
  const theme = useTheme();
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

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingIndex(null);
    setEditingValue("");
    setNewChipValue("");
    chipEdit.reset();
  };

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

  return (
    <div className="msqdx-glass-dashboard-card-section" ref={containerRef}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 1
        }}
      >
        {label && (
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
        )}
        {editable && !isEditing && (
          <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
            {onAiSuggest && (
              <MsqdxGlassAiButtonIcon
                onClick={onAiSuggest}
                disabled={aiLoading}
                loading={aiLoading}
                size="small"
                fontSize={18}
                title="AI Vorschlag"
                aria-label="AI Vorschlag"
              />
            )}
            {hasChips && (
              <MsqdxGlassEditButton
                onClick={handleStartEdit}
                size="small"
                fontSize={18}
                aria-label="Edit chips"
              />
            )}
          </Box>
        )}
      </Box>

      {showEmptyState ? (
        <Box sx={{ color: "text.secondary", fontStyle: "italic", fontSize: "0.875rem" }}>
          {emptyMessage}
        </Box>
      ) : (
        <>
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 0.5,
              mb: isEditing ? 1 : 0
            }}
          >
            {displayChips.map((chip, idx) => (
              <Box
                key={idx}
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.5
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
                    variant={chipClassName.includes("--trait") ? "trait" : 
                            chipClassName.includes("--vocab") ? "vocab" :
                            chipClassName.includes("--pain") ? "pain" :
                            chipClassName.includes("--goal") ? "goal" :
                            chipClassName.includes("--value") ? "value" :
                            chipClassName.includes("--interest") ? "interest" :
                            chipClassName.includes("--social") ? "social" : "trait"}
                    dashboard={true}
                    highlighted={highlightedChips.some((highlight) => highlight.trim().toLowerCase() === chip.trim().toLowerCase())}
                    onClick={isEditing ? () => handleStartEditChip(idx, chip) : undefined}
                  >
                    {chip}
                  </MsqdxGlassChip>
                )}
                {isEditing && editingIndex !== idx && (
                  <MsqdxButton
                    variant="text"
                    size="small"
                    onClick={() => handleRemoveChip(idx)}
                    aria-label="Remove"
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
              <Box ref={newInputWrapperRef} sx={{ minWidth: "180px" }}>
                <MsqdxInput
                  value={newChipValue}
                  onChange={(e) => setNewChipValue(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, false, null)}
                  placeholder="Neuen Eintrag hinzufügen..."
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
              title="AI Vorschlag"
                aria-label="AI Vorschlag"
              />
              <Box component="span" sx={{ fontSize: "0.875rem" }}>
                AI Vorschlag
              </Box>
            </Box>
          )}
          <MsqdxButton
            variant="text"
            size="small"
            onClick={handleStartEdit}
            startIcon={<MsqdxIcon name="add" customSize={18} />}
            aria-label="Add"
          >
            Add
          </MsqdxButton>
        </Box>
      )}
    </div>
  );
};

