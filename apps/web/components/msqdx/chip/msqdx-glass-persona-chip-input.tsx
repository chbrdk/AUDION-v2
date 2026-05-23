"use client";

import clsx from "clsx";
import { forwardRef, type CSSProperties, type KeyboardEvent, type Ref } from "react";
import type { MsqdxGlassPersonaChipVariant } from "./msqdx-glass-persona-chip";

export type MsqdxGlassPersonaChipInputProps = {
  variant: MsqdxGlassPersonaChipVariant;
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  placeholder?: string;
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
    placeholder,
    block = false,
    className,
    style,
    "aria-label": ariaLabel,
  }: MsqdxGlassPersonaChipInputProps,
  ref: Ref<HTMLInputElement>
) {
  return (
    <span
      className={clsx(
        "msqdx-glass-chip",
        "--dashboard",
        `--${variant}`,
        "--interactive",
        "--editing",
        block && "--block",
        className
      )}
      style={style}
    >
      <input
        ref={ref}
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
    </span>
  );
});
