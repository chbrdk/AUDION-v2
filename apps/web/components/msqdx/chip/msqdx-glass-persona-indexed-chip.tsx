"use client";

import clsx from "clsx";
import { Box } from "@mui/material";
import { MsqdxCornerBox } from "@msqdx/react";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { MONO_FONT_SX } from "../../../lib/msqdx-typography";
import {
  PAIN_GOALS_SLIDE_INDEX_BADGE_RADIUS_PX,
  PAIN_GOALS_SLIDE_INDEX_BADGE_SIZE,
} from "../../../lib/chip-editor-corner-tab";
import type { MsqdxGlassPersonaChipVariant } from "./msqdx-glass-persona-chip";

/** Pain / goal slider chips with index corner (MsqdxCornerBox top-left). */
export type MsqdxGlassPersonaIndexedChipVariant = Extract<
  MsqdxGlassPersonaChipVariant,
  "pain" | "goal"
>;

export type MsqdxGlassPersonaIndexedChipProps = {
  label: string;
  variant: MsqdxGlassPersonaIndexedChipVariant;
  /** 1-based slide index shown in the corner badge. */
  index: number;
  indexAriaLabel: string;
  highlighted?: boolean;
  /** Enables hover affordance and double-click / keyboard edit. */
  editable?: boolean;
  /** Double-click: enter edit mode and focus this chip. */
  onRequestEdit?: () => void;
  /** Single-click while bulk-editing (switch active chip). */
  onClick?: () => void;
  /** When true, renders `children` instead of the label. */
  editing?: boolean;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

/**
 * Large indexed persona chip for pain/goals slider slides.
 * Same interaction model as {@link MsqdxGlassPersonaChip} plus top-left index corner.
 */
export function MsqdxGlassPersonaIndexedChip({
  label,
  variant,
  index,
  indexAriaLabel,
  highlighted = false,
  editable = false,
  onRequestEdit,
  onClick,
  editing = false,
  children,
  className,
  style,
}: MsqdxGlassPersonaIndexedChipProps) {
  const interactive = editable && Boolean(onRequestEdit || onClick) && !editing;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
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
    <div
      className={clsx(
        "msqdx-glass-chip",
        "--dashboard",
        `--${variant}`,
        "--indexed",
        highlighted && "--is-new",
        interactive && "--interactive",
        "msqdx-glass-persona-indexed-chip",
        "msqdx-glass-pain-goals-slide-card",
        `--${variant}`,
        "msqdx-glass-pain-goals-slide-card--indexed",
        className
      )}
      style={style}
    >
      <div
        className={clsx(
          "msqdx-glass-persona-indexed-chip__body",
          "msqdx-glass-pain-goals-slide-card__body",
          "msqdx-glass-pain-goals-slide-card__body--indexed"
        )}
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-label={interactive ? label : undefined}
        onClick={interactive ? onClick : undefined}
        onDoubleClick={interactive && onRequestEdit ? onRequestEdit : undefined}
        onKeyDown={handleKeyDown}
      >
        <MsqdxCornerBox
          className="msqdx-glass-pain-goals-slide-card__index-corner"
          topLeft="square"
          topRight="cutdown-a"
          bottomLeft="cutdown-b"
          bottomRight="rounded"
          borderRadius={PAIN_GOALS_SLIDE_INDEX_BADGE_RADIUS_PX}
          aria-label={indexAriaLabel}
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
            {index}
          </Box>
        </MsqdxCornerBox>
        {editing && children ? (
          <div className="msqdx-glass-persona-indexed-chip__edit">{children}</div>
        ) : (
          <span className="msqdx-glass-persona-indexed-chip__label">{label}</span>
        )}
      </div>
    </div>
  );
}
