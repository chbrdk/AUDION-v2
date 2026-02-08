import type { Meta, StoryObj } from '@storybook/react';
import { ChatHistoryList } from './components/ChatHistoryList';

const mockConversations = [
  { conversationId: 'c1', title: 'Product feedback', updatedAt: new Date(), messageCount: 8 },
  { conversationId: 'c2', title: 'Pricing discussion', updatedAt: new Date(Date.now() - 86400000), messageCount: 3 },
];

const meta: Meta<typeof ChatHistoryList> = {
  title: 'AUDION/ChatHistoryList',
  component: ChatHistoryList,
  parameters: { layout: 'centered' },
};

export default meta;

type Story = StoryObj<typeof ChatHistoryList>;

export const Default: Story = {
  args: { conversations: mockConversations, onSelect: (id) => console.log(id) },
};

export const Empty: Story = {
  args: { conversations: [], onSelect: () => {} },
};
