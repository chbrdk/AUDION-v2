/**
 * Unit Tests für React 19 Features
 * 
 * Testet useOptimistic und useEffectEvent Hooks
 */

import { describe, it, expect } from '@jest/globals';
import { renderHook, act } from '@testing-library/react';
import { useOptimisticMessages } from '../../apps/web/hooks/use-optimistic-messages';
import { useStreamProcessor } from '../../apps/web/hooks/use-effect-event';

describe('React 19 Features', () => {
  describe('useOptimisticMessages', () => {
    it('should add optimistic message', () => {
      const initialMessages = [
        { id: '1', role: 'user' as const, content: 'Hello' },
      ];

      const { result } = renderHook(() => useOptimisticMessages(initialMessages));

      act(() => {
        result.current.addMessage({
          id: 'temp-1',
          role: 'user',
          content: 'New message',
        });
      });

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[1].isOptimistic).toBe(true);
    });

    it('should handle multiple optimistic messages', () => {
      const initialMessages: any[] = [];

      const { result } = renderHook(() => useOptimisticMessages(initialMessages));

      act(() => {
        result.current.addMessage({ id: 'temp-1', role: 'user', content: 'Message 1' });
        result.current.addMessage({ id: 'temp-2', role: 'user', content: 'Message 2' });
      });

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages.every(m => m.isOptimistic)).toBe(true);
    });
  });

  describe('useStreamProcessor', () => {
    it('should create stable event handlers', () => {
      const onDelta = jest.fn();
      const onComplete = jest.fn();
      const onError = jest.fn();

      const { result, rerender } = renderHook(() =>
        useStreamProcessor(onDelta, onComplete, onError)
      );

      const firstHandlers = result.current;

      // Rerender sollte gleiche Handler-Referenzen zurückgeben
      rerender();
      const secondHandlers = result.current;

      // Handlers sollten stabil sein (gleiche Referenz)
      expect(firstHandlers.handleDelta).toBe(secondHandlers.handleDelta);
      expect(firstHandlers.handleComplete).toBe(secondHandlers.handleComplete);
      expect(firstHandlers.handleError).toBe(secondHandlers.handleError);
    });
  });
});
