import type { Meta, StoryObj } from '@storybook/react';
import { TargetGroupAdminPanel } from './components/TargetGroupAdminPanel';

const mockTargetGroups = [
  { id: '1', name: 'Enterprise IT', segment: 'B2B', personaCount: 3, knowledgeEntryCount: 12 },
];

const meta: Meta<typeof TargetGroupAdminPanel> = {
  title: 'AUDION/TargetGroupAdminPanel',
  component: TargetGroupAdminPanel,
  parameters: { layout: 'centered' },
};

export default meta;

type Story = StoryObj<typeof TargetGroupAdminPanel>;

export const Default: Story = {
  args: { targetGroups: mockTargetGroups, onSelect: (id) => console.log(id) },
};

export const Empty: Story = {
  args: { targetGroups: [] },
};
