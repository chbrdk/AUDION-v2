import type { Meta, StoryObj } from '@storybook/react';
import { AdminDashboard } from './components/AdminDashboard';

const meta: Meta<typeof AdminDashboard> = {
  title: 'AUDION/AdminDashboard',
  component: AdminDashboard,
  parameters: { layout: 'centered' },
};

export default meta;

type Story = StoryObj<typeof AdminDashboard>;

export const Default: Story = {
  args: {
    personaCount: 12,
    targetGroupCount: 4,
    onNavigatePersonas: () => console.log('Personas'),
    onNavigateTargetGroups: () => console.log('Target Groups'),
  },
};

export const Empty: Story = {
  args: { personaCount: 0, targetGroupCount: 0 },
};
