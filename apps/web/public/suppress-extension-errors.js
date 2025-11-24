/**
 * This script suppresses errors from browser extensions.
 * It must be loaded early, before extensions inject their content scripts.
 */
(function () {
  "use strict";

  // Filter function to check if error is from browser extension
  function isExtensionError(message, source, stack) {
    const allText = `${message || ""} ${source || ""} ${stack || ""}`.toLowerCase();

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
      "cannot read properties of undefined (reading 'control')",
      "control",
      "autofill",
      "password-manager",
    ];

    return extensionIndicators.some(function (indicator) {
      return allText.includes(indicator.toLowerCase());
    });
  }

  // Store original console methods
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  const originalConsoleLog = console.log;

  // Override console.error
  console.error = function () {
    const args = Array.prototype.slice.call(arguments);
    const message = args.map(function (arg) {
      return String(arg);
    }).join(" ");

    if (isExtensionError(message)) {
      return; // Silently ignore extension errors
    }

    originalConsoleError.apply(console, arguments);
  };

  // Override console.warn
  console.warn = function () {
    const args = Array.prototype.slice.call(arguments);
    const message = args.map(function (arg) {
      return String(arg);
    }).join(" ");

    if (isExtensionError(message)) {
      return; // Silently ignore extension warnings
    }

    originalConsoleWarn.apply(console, arguments);
  };

  // Override window.onerror (must be done early)
  const originalOnError = window.onerror;
  window.onerror = function (message, source, lineno, colno, error) {
    if (isExtensionError(message, source, error && error.stack)) {
      return true; // Suppress extension errors
    }

    if (originalOnError) {
      return originalOnError(message, source, lineno, colno, error);
    }

    return false;
  };

  // Handle unhandled promise rejections
  window.addEventListener(
    "unhandledrejection",
    function (event) {
      const reason = event.reason;
      const message =
        (reason && reason.message) || String(reason || "");

      if (isExtensionError(message)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
    },
    true // Use capture phase
  );

  // Handle errors via error event listener
  window.addEventListener(
    "error",
    function (event) {
      if (
        isExtensionError(
          event.message,
          event.filename,
          event.error && event.error.stack
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
        return false;
      }
    },
    true // Use capture phase
  );
})();


