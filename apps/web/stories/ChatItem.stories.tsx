import type { Meta, StoryObj } from '@storybook/react';
import { ChatItem } from './components/ChatItem';

const mockConversation = {
  conversationId: 'c1',
  title: 'Product feedback discussion',
  updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
  messageCount: 8,
};

const meta: Meta<typeof ChatItem> = {
  title: 'AUDION/ChatItem',
  component: ChatItem,
  parameters: { layout: 'centered' },
};

export default meta;

type Story = StoryObj<typeof ChatItem>;

export const Default: Story = {
  args: {
    conversation: mockConversation,
    onSelect: (id) => console.log('Selected', id),
  },
};

export const Older: Story = {
  args: {
    conversation: {
      ...mockConversation,
      title: 'Older chat',
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
      messageCount: 3,
    },
    onSelect: (id) => console.log('Selected', id),
  },
};
