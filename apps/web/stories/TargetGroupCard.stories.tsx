import type { Meta, StoryObj } from '@storybook/react';
import { TargetGroupCard } from './components/TargetGroupCard';

const mockTargetGroup = {
  id: 'tg1',
  name: 'Enterprise IT',
  segment: 'B2B',
  description: 'IT decision makers in enterprises with 500+ employees.',
  personaCount: 3,
  knowledgeEntryCount: 12,
};

const meta: Meta<typeof TargetGroupCard> = {
  title: 'AUDION/TargetGroupCard',
  component: TargetGroupCard,
  parameters: { layout: 'centered' },
};

export default meta;

type Story = StoryObj<typeof TargetGroupCard>;

export const Default: Story = {
  args: { targetGroup: mockTargetGroup },
};

export const Selected: Story = {
  args: { targetGroup: mockTargetGroup, selected: true },
};
