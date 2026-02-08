import type { Meta, StoryObj } from '@storybook/react';
import { FieldEditor } from './components/FieldEditor';

const meta: Meta<typeof FieldEditor> = {
  title: 'AUDION/FieldEditor',
  component: FieldEditor,
  parameters: { layout: 'centered' },
};

export default meta;

type Story = StoryObj<typeof FieldEditor>;

export const Text: Story = {
  args: {
    field: { key: 'name', label: 'Name', type: 'text', placeholder: 'Enter name' },
    value: 'Alex',
    onChange: (key, value) => console.log(key, value),
    inline: true,
  },
};

export const Boolean: Story = {
  args: {
    field: { key: 'active', label: 'Active', type: 'boolean' },
    value: true,
    onChange: (key, value) => console.log(key, value),
  },
};
