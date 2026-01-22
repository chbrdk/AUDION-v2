/**
 * React 19 useEffectEvent Hook für Stream-Processing
 * 
 * Ermöglicht bessere Effect-Logik ohne Closure-Probleme.
 * Ideal für Stream-Processing und Event-Handler.
 * 
 * Polyfill für useEffectEvent (experimentell in React 19)
 */

import { useRef, useCallback } from "react";

/**
 * Polyfill für useEffectEvent
 * Erstellt eine stabile Funktion, die immer die neueste Version des Callbacks verwendet
 */
function useEffectEvent<T extends (...args: any[]) => any>(callback: T): T {
  const ref = useRef(callback);
  ref.current = callback;
  
  return useCallback((...args: Parameters<T>) => {
    return ref.current(...args);
  }, []) as T;
}

/**
 * Beispiel: useEffectEvent für Stream-Processing
 * 
 * Verhindert Closure-Probleme bei Stream-Callbacks
 */
export function useStreamProcessor(
  onDelta: (delta: string) => void,
  onComplete: () => void,
  onError: (error: string) => void
) {
  // useEffectEvent extrahiert non-reactive Logic
  const handleDelta = useEffectEvent(onDelta);
  const handleComplete = useEffectEvent(onComplete);
  const handleError = useEffectEvent(onError);

  // Diese Funktionen können in Effects verwendet werden
  // ohne dass sie bei jedem Render neu erstellt werden
  return {
    handleDelta,
    handleComplete,
    handleError,
  };
}

/**
 * Beispiel: useEffectEvent für Event-Handler
 */
export function useEventHandlers(
  onMessage: (message: string) => void,
  onError: (error: Error) => void
) {
  const handleMessage = useEffectEvent(onMessage);
  const handleError = useEffectEvent(onError);

  return {
    handleMessage,
    handleError,
  };
}
