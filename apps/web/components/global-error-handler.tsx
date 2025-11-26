"use client";

import { useEffect } from "react";

/**
 * Global error handler that filters out errors from browser extensions
 * to prevent console pollution from third-party scripts.
 */
export function GlobalErrorHandler() {
  useEffect(() => {
    // Only run in browser environment
    if (typeof window === "undefined") {
      return;
    }
    // Filter function to check if error is from browser extension
    const isExtensionError = (
      message?: string | Event,
      source?: string,
      error?: Error
    ): boolean => {
      const errorMessage =
        typeof message === "string"
          ? message
          : error?.message || String(message || "");
      const errorSource = source || "";
      const stackTrace = error?.stack || "";

      // Check for common extension indicators
      const extensionIndicators = [
        "content_script.js",
        "extension://",
        "moz-extension://",
        "chrome-extension://",
        "safari-extension://",
        "edge-extension://",
        "shouldOfferCompletionListField",
        "shouldOfferCompletionListForField",
        "elementWasFocused",
        "focusInEventHandler",
        "processInputEvent",
        "inputEventHandler",
        "control",
        "autofill",
        "password-manager",
        "Cannot read properties of undefined (reading 'control')",
      ];

      const allText = `${errorMessage} ${errorSource} ${stackTrace}`.toLowerCase();

      return extensionIndicators.some((indicator) =>
        allText.includes(indicator.toLowerCase())
      );
    };

    // Store original console methods
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;

    // Override console.error to filter extension errors
    console.error = (...args: unknown[]) => {
      const errorMessage = args.map((arg) => String(arg)).join(" ");
      
      if (isExtensionError(errorMessage)) {
        // Silently ignore extension errors
        return;
      }

      // Call original console.error for non-extension errors
      originalConsoleError.apply(console, args);
    };

    // Override console.warn to filter extension warnings
    console.warn = (...args: unknown[]) => {
      const warningMessage = args.map((arg) => String(arg)).join(" ");
      
      if (isExtensionError(warningMessage)) {
        // Silently ignore extension warnings
        return;
      }

      // Call original console.warn for non-extension warnings
      originalConsoleWarn.apply(console, args);
    };

    // Store original error handlers
    const originalError = window.onerror;
    const originalUnhandledRejection = window.onunhandledrejection;

    // Override window.onerror
    window.onerror = (
      message: string | Event,
      source?: string,
      lineno?: number,
      colno?: number,
      error?: Error
    ): boolean => {
      // Check if this is an extension error
      if (isExtensionError(message, source, error)) {
        // Silently ignore extension errors
        return true; // Prevent default error handling
      }

      // Call original error handler for non-extension errors
      if (originalError) {
        return originalError(message, source, lineno, colno, error);
      }

      return false; // Allow default error handling
    };

    // Override unhandled promise rejection handler
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const errorMessage =
        event.reason?.message || String(event.reason || "");

      if (isExtensionError(errorMessage)) {
        // Silently ignore extension errors
        event.preventDefault(); // Prevent default error handling
        return;
      }

      // Call original handler for non-extension errors
      if (originalUnhandledRejection) {
        originalUnhandledRejection.call(window, event);
      }
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    // Also intercept errors via addEventListener
    const handleError = (event: ErrorEvent) => {
      if (
        isExtensionError(
          event.message,
          event.filename,
          event.error
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
        return false;
      }
    };

    window.addEventListener("error", handleError, true); // Use capture phase

    // Cleanup function
    return () => {
      console.error = originalConsoleError;
      console.warn = originalConsoleWarn;
      window.onerror = originalError;
      window.removeEventListener("error", handleError, true);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      if (originalUnhandledRejection) {
        window.onunhandledrejection = originalUnhandledRejection;
      }
    };
  }, []);

  return null; // This component doesn't render anything
}

