"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export type UseInlineEditOptions<T> = {
  /**
   * Initial value
   */
  initialValue: T;
  /**
   * Current value from props (for syncing with external state)
   */
  currentValue?: T;
  /**
   * Comparison function to determine if values are equal
   */
  isEqual?: (a: T, b: T) => boolean;
  /**
   * Callback when value changes
   */
  onChange?: (value: T) => void;
};

export type UseInlineEditReturn<T> = {
  /**
   * Current local value
   */
  value: T;
  /**
   * Set the local value
   */
  setValue: (value: T) => void;
  /**
   * Whether there are unsaved changes
   */
  hasChanges: boolean;
  /**
   * Reset to initial value (discard changes)
   */
  reset: () => void;
  /**
   * Reset to current value (sync with external state)
   */
  sync: () => void;
  /**
   * The element ref to attach to the input
   */
  elementRef: React.RefObject<HTMLElement | null>;
  /**
   * Get the current value for saving
   */
  getValue: () => T;
};

const defaultIsEqual = <T,>(a: T, b: T): boolean => {
  if (a === b) return true;
  if (a === null || a === undefined || b === null || b === undefined) return false;
  if (typeof a === "object" && typeof b === "object") {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
};

export function useInlineEdit<T>({
  initialValue,
  currentValue,
  isEqual = defaultIsEqual,
  onChange
}: UseInlineEditOptions<T>): UseInlineEditReturn<T> {
  const [value, setValue] = useState<T>(initialValue);
  const elementRef = useRef<HTMLElement>(null);

  // Sync with currentValue when it changes externally
  useEffect(() => {
    if (currentValue !== undefined && !isEqual(value, currentValue)) {
      // Only sync if we don't have local changes
      // This prevents overwriting user edits
      const hasLocalChanges = !isEqual(value, initialValue);
      if (!hasLocalChanges) {
        setValue(currentValue);
      }
    }
  }, [currentValue, initialValue, isEqual, value]);

  // Update local value when initialValue changes (but not when user is editing)
  useEffect(() => {
    if (!isEqual(value, initialValue) && currentValue === undefined) {
      // User has changes, don't override
      return;
    }
    if (!isEqual(value, initialValue)) {
      // Check if the change is from external update
      return;
    }
    setValue(initialValue);
  }, [initialValue, isEqual, value, currentValue]);

  const handleChange = useCallback((newValue: T) => {
    setValue(newValue);
    onChange?.(newValue);
  }, [onChange]);

  const hasChanges = !isEqual(value, initialValue);

  const reset = useCallback(() => {
    setValue(initialValue);
  }, [initialValue]);

  const sync = useCallback(() => {
    if (currentValue !== undefined) {
      setValue(currentValue);
    } else {
      setValue(initialValue);
    }
  }, [currentValue, initialValue]);

  const getValue = useCallback(() => value, [value]);

  return {
    value,
    setValue: handleChange,
    hasChanges,
    reset,
    sync,
    elementRef,
    getValue
  };
}

