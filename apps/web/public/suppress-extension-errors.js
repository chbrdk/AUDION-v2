/**
 * This script suppresses errors from browser extensions and Next.js HMR WebSocket connections.
 * It must be loaded early, before extensions inject their content scripts.
 */
(function () {
  "use strict";

  // Filter function to check if error is from browser extension or HMR WebSocket
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

    const hmrIndicators = [
      "websocket connection",
      "webpack-hmr",
      "webpack hmr",
      "failed to connect",
      "connection failed",
      "_next/webpack-hmr",
      "web-socket.js",
      "webpack.js",
    ];

    return (
      extensionIndicators.some(function (indicator) {
        return allText.includes(indicator.toLowerCase());
      }) ||
      hmrIndicators.some(function (indicator) {
        return allText.includes(indicator.toLowerCase());
      })
    );
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

    // Check if it's an extension error or HMR WebSocket error
    if (isExtensionError(message)) {
      return; // Silently ignore extension errors
    }
    
    // Also check for WebSocket connection errors in the message
    if (message.includes("WebSocket connection") && 
        (message.includes("webpack-hmr") || message.includes("_next/webpack-hmr") || message.includes("failed"))) {
      return; // Silently ignore HMR WebSocket connection errors
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

  // Suppress WebSocket connection errors from Next.js HMR
  // This prevents console spam when HMR WebSocket connections fail
  const originalWebSocket = window.WebSocket;
  window.WebSocket = function (url, protocols) {
    const urlString = String(url || "");
    const isHmrConnection = urlString.includes("webpack-hmr") || urlString.includes("_next/webpack-hmr");
    
    let ws;
    try {
      ws = new originalWebSocket(url, protocols);
    } catch (error) {
      // If it's an HMR connection, silently fail
      if (isHmrConnection) {
        // Return a mock WebSocket that does nothing
        return {
          readyState: 3, // CLOSED
          url: urlString,
          protocol: "",
          extensions: "",
          binaryType: "blob",
          bufferedAmount: 0,
          onopen: null,
          onerror: null,
          onclose: null,
          onmessage: null,
          close: function() {},
          send: function() {},
          addEventListener: function() {},
          removeEventListener: function() {},
          dispatchEvent: function() { return true; },
          CONNECTING: 0,
          OPEN: 1,
          CLOSING: 2,
          CLOSED: 3
        };
      }
      throw error;
    }
    
    // For HMR connections, suppress all error handling
    if (isHmrConnection) {
      // Override addEventListener to suppress error/close events
      const originalAddEventListener = ws.addEventListener.bind(ws);
      ws.addEventListener = function (type, listener, options) {
        if (type === "error" || type === "close") {
          // Don't add listeners for error/close on HMR connections
          return;
        }
        return originalAddEventListener(type, listener, options);
      };
      
      // Suppress onerror and onclose handlers
      Object.defineProperty(ws, 'onerror', {
        get: function() { return null; },
        set: function() { /* ignore */ },
        configurable: true
      });
      
      Object.defineProperty(ws, 'onclose', {
        get: function() { return null; },
        set: function() { /* ignore */ },
        configurable: true
      });
      
      // Wrap close to prevent errors
      const originalClose = ws.close.bind(ws);
      ws.close = function() {
        try {
          originalClose();
        } catch (e) {
          // Ignore close errors
        }
      };
    }
    
    return ws;
  };
})();


