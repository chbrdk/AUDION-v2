import type { ConversationHistory, ChatMessage } from '../types';

const STORAGE_KEY_CONVERSATIONS = 'audion-conversations';
const STORAGE_KEY_SETTINGS = 'audion-settings';

export function generateConversationId(selectionId: string, personaId: string): string {
  return `${selectionId}-${personaId}`;
}

export async function saveConversation(
  conversation: ConversationHistory
): Promise<void> {
  try {
    const conversations = await loadAllConversations();
    conversations[conversation.conversationId] = conversation;
    await figma.clientStorage.setAsync(STORAGE_KEY_CONVERSATIONS, conversations);
  } catch (error) {
    throw new Error(`Failed to save conversation: ${error}`);
  }
}

export async function loadConversation(
  conversationId: string
): Promise<ConversationHistory | null> {
  try {
    const conversations = await loadAllConversations();
    return conversations[conversationId] || null;
  } catch (error) {
    console.error('Failed to load conversation:', error);
    return null;
  }
}

export async function loadAllConversations(): Promise<
  Record<string, ConversationHistory>
> {
  try {
    const conversations = await figma.clientStorage.getAsync(
      STORAGE_KEY_CONVERSATIONS
    );
    return conversations || {};
  } catch (error) {
    console.error('Failed to load conversations:', error);
    return {};
  }
}

export async function addMessageToConversation(
  conversationId: string,
  message: ChatMessage
): Promise<ConversationHistory> {
  const conversation = await loadConversation(conversationId);

  if (!conversation) {
    throw new Error(`Conversation ${conversationId} not found`);
  }

  conversation.messages.push(message);
  conversation.updatedAt = Date.now();

  await saveConversation(conversation);
  return conversation;
}

export async function createConversation(
  conversationId: string,
  personaId: string,
  selectionId: string
): Promise<ConversationHistory> {
  const conversation: ConversationHistory = {
    conversationId,
    personaId,
    selectionId,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await saveConversation(conversation);
  return conversation;
}

export async function clearConversation(conversationId: string): Promise<void> {
  try {
    const conversations = await loadAllConversations();
    delete conversations[conversationId];
    await figma.clientStorage.setAsync(STORAGE_KEY_CONVERSATIONS, conversations);
  } catch (error) {
    throw new Error(`Failed to clear conversation: ${error}`);
  }
}

export async function clearAllConversations(): Promise<void> {
  try {
    await figma.clientStorage.setAsync(STORAGE_KEY_CONVERSATIONS, {});
  } catch (error) {
    throw new Error(`Failed to clear all conversations: ${error}`);
  }
}

export async function getConversationsForSelection(
  selectionId: string
): Promise<ConversationHistory[]> {
  const allConversations = await loadAllConversations();
  return Object.values(allConversations).filter(
    (conv) => conv.selectionId === selectionId
  );
}



