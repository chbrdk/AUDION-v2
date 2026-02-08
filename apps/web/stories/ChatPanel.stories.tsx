import type { Meta, StoryObj } from '@storybook/react';
import { ChatPanel } from './components/ChatPanel';

const mockMessages = [
  { id: '1', role: 'user' as const, content: 'What are the main pain points?' },
  { id: '2', role: 'persona' as const, content: 'Based on our research, budget and timeline are the top concerns.', personaName: 'Alex' },
  { id: '3', role: 'user' as const, content: 'Thanks, that helps.' },
];

const meta: Meta<typeof ChatPanel> = {
  title: 'AUDION/ChatPanel',
  component: ChatPanel,
  parameters: { layout: 'centered' },
};

export default meta;

type Story = StoryObj<typeof ChatPanel>;

export const Default: Story = {
  args: { messages: mockMessages },
};
