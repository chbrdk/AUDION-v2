import type { Meta, StoryObj } from '@storybook/react';
import { ChipEditor } from './components/ChipEditor';

const meta: Meta<typeof ChipEditor> = {
  title: 'AUDION/ChipEditor',
  component: ChipEditor,
  parameters: { layout: 'centered' },
};

export default meta;

type Story = StoryObj<typeof ChipEditor>;

export const Default: Story = {
  args: {
    label: 'Interests',
    chips: ['Research', 'UX', 'Interviews'],
    onSave: async (chips) => console.log('Save', chips),
    editable: true,
    emptyMessage: 'No interests',
  },
};

export const Empty: Story = {
  args: {
    label: 'Tags',
    chips: [],
    onSave: async (chips) => console.log('Save', chips),
    editable: true,
    emptyMessage: 'No tags yet',
  },
};
