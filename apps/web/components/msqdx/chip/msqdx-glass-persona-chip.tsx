"use client";

import clsx from "clsx";
import type { CSSProperties, KeyboardEvent } from "react";
import {
  MsqdxGlassChip,
  type MsqdxGlassChipVariant,
} from "../../generic/msqdx-glass-chip";

/** Persona admin chip variants (dashboard / v2 sections). */
export type MsqdxGlassPersonaChipVariant = Extract<
  MsqdxGlassChipVariant,
  "trait" | "interest" | "value" | "social" | "vocab" | "sentence" | "pain" | "goal"
>;

const PERSONA_CHIP_VARIANTS = new Set<MsqdxGlassPersonaChipVariant>([
  "trait",
  "interest",
  "value",
  "social",
  "vocab",
  "sentence",
  "pain",
  "goal",
]);

export function isMsqdxGlassPersonaChipVariant(
  variant: MsqdxGlassChipVariant
): variant is MsqdxGlassPersonaChipVariant {
  return PERSONA_CHIP_VARIANTS.has(variant as MsqdxGlassPersonaChipVariant);
}

export type MsqdxGlassPersonaChipProps = {
  label: string;
  variant: MsqdxGlassPersonaChipVariant;
  highlighted?: boolean;
  /** Enables hover affordance and double-click / keyboard edit. */
  editable?: boolean;
  /** Double-click: enter edit mode and focus this chip. */
  onRequestEdit?: () => void;
  /** Single-click while already editing (switch active chip). */
  onClick?: () => void;
  className?: string;
  block?: boolean;
  /** Wrapped multi-line chip (grid / list). */
  multiline?: boolean;
  style?: CSSProperties;
};

/**
 * Standard persona tag chip for v2 sections (traits, vocabulary, pain/goals labels in grid, …).
 * Hover + double-click to edit when `editable` is set.
 */
export function MsqdxGlassPersonaChip({
  label,
  variant,
  highlighted = false,
  editable = false,
  onRequestEdit,
  onClick,
  className,
  block = false,
  multiline = false,
  style,
}: MsqdxGlassPersonaChipProps) {
  const useBlockLayout = block || multiline;
  const interactive = editable && Boolean(onRequestEdit || onClick);

  const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (!interactive) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (onClick) {
        onClick();
      } else {
        onRequestEdit?.();
      }
    }
  };

  return (
    <MsqdxGlassChip
      variant={variant}
      dashboard
      highlighted={highlighted}
      interactive={interactive}
      className={clsx(
        useBlockLayout && "--block",
        multiline && "--multiline",
        className
      )}
      style={style}
      onClick={onClick}
      onDoubleClick={interactive && onRequestEdit ? onRequestEdit : undefined}
      onKeyDown={handleKeyDown}
      aria-label={interactive ? label : undefined}
    >
      {label}
    </MsqdxGlassChip>
  );
}
