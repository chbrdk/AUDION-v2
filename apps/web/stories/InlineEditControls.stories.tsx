import type { Meta, StoryObj } from '@storybook/react';
import { InlineEditControls } from './components/InlineEditControls';

const meta: Meta<typeof InlineEditControls> = {
  title: 'AUDION/InlineEditControls',
  component: InlineEditControls,
  parameters: { layout: 'centered' },
};

export default meta;

type Story = StoryObj<typeof InlineEditControls>;

export const WithChanges: Story = {
  args: {
    hasChanges: true,
    saving: false,
    onSave: () => console.log('Save'),
    onDiscard: () => console.log('Discard'),
  },
};

export const Saving: Story = {
  args: {
    hasChanges: true,
    saving: true,
    onSave: async () => new Promise((r) => setTimeout(r, 1000)),
    onDiscard: () => console.log('Discard'),
  },
};
