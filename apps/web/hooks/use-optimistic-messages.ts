/**
 * React 19 useOptimistic Hook für Chat Messages
 * 
 * Ermöglicht optimistic UI updates für Chat-Messages mit automatischem Rollback
 * bei Fehlern.
 */

import { useOptimistic } from "react";

export type Message = {
  id: string;
  role: "user" | "persona" | "system";
  content: string;
  personaName?: string;
  images?: string[];
  isOptimistic?: boolean; // Mark optimistic messages
};

export function useOptimisticMessages(initialMessages: Message[]) {
  const [optimisticMessages, addOptimisticMessage] = useOptimistic(
    initialMessages,
    (state, newMessage: Message) => {
      // Add new message optimistically
      return [...state, { ...newMessage, isOptimistic: true }];
    }
  );

  const addMessage = (message: Message) => {
    addOptimisticMessage(message);
  };

  const confirmMessage = (messageId: string, confirmedMessage: Message) => {
    // Replace optimistic message with confirmed one
    // This would be called when server confirms the message
    // Implementation depends on your state management
  };

  const rollbackMessage = (messageId: string) => {
    // Remove optimistic message on error
    // Implementation depends on your state management
  };

  return {
    messages: optimisticMessages,
    addMessage,
    confirmMessage,
    rollbackMessage,
  };
}
