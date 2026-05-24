"use client";

import clsx from "clsx";
import { MsqdxIcon } from "@msqdx/react";
import {
  forwardRef,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type Ref,
} from "react";
import type { MsqdxGlassPersonaChipVariant } from "./msqdx-glass-persona-chip";

export type MsqdxGlassPersonaChipInputProps = {
  variant: MsqdxGlassPersonaChipVariant;
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onBlur?: () => void;
  onDelete?: () => void;
  deleteAriaLabel?: string;
  placeholder?: string;
  /** Full-width chip with wrapped text (grid / list layouts). */
  multiline?: boolean;
  block?: boolean;
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
};

/**
 * Inline editor styled as a persona dashboard chip (no MsqdxInput chrome).
 */
export const MsqdxGlassPersonaChipInput = forwardRef(function MsqdxGlassPersonaChipInput(
  {
    variant,
    value,
    onChange,
    onKeyDown,
    onBlur,
    onDelete,
    deleteAriaLabel = "Remove",
    placeholder,
    multiline = false,
    block = false,
    className,
    style,
    "aria-label": ariaLabel,
  }: MsqdxGlassPersonaChipInputProps,
  ref: Ref<HTMLInputElement | HTMLTextAreaElement>
) {
  const useBlockLayout = block || multiline;

  const handleDeleteMouseDown = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  const handleDeleteClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onDelete?.();
  };

  return (
    <span
      className={clsx(
        "msqdx-glass-persona-chip-edit-shell",
        useBlockLayout && "msqdx-glass-persona-chip-edit-shell--block",
        multiline && "msqdx-glass-persona-chip-edit-shell--multiline",
        className
      )}
      style={style}
    >
      <span
        className={clsx(
          "msqdx-glass-chip",
          "--dashboard",
          `--${variant}`,
          "--interactive",
          "--editing",
          useBlockLayout && "--block",
          multiline && "--multiline"
        )}
      >
        {multiline ? (
          <textarea
            ref={ref as Ref<HTMLTextAreaElement>}
            className="msqdx-glass-persona-chip__input msqdx-glass-persona-chip__input--multiline"
            value={value}
            placeholder={placeholder}
            aria-label={ariaLabel}
            rows={3}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={onKeyDown}
            onBlur={onBlur}
          />
        ) : (
          <input
            ref={ref as Ref<HTMLInputElement>}
            className="msqdx-glass-persona-chip__input"
            type="text"
            value={value}
            placeholder={placeholder}
            aria-label={ariaLabel}
            size={Math.max(value.length, placeholder?.length ?? 8, 8)}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={onKeyDown}
            onBlur={onBlur}
          />
        )}
      </span>
      {onDelete ? (
        <button
          type="button"
          className="msqdx-glass-persona-chip-edit-shell__delete"
          aria-label={deleteAriaLabel}
          onMouseDown={handleDeleteMouseDown}
          onClick={handleDeleteClick}
        >
          <MsqdxIcon
            name="delete"
            customSize={14}
            style={{ color: "var(--color-status-error, #d32f2f)" }}
          />
        </button>
      ) : null}
    </span>
  );
});
