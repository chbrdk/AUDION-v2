import type { Meta, StoryObj } from '@storybook/react';
import { UploadDropzone } from './components/UploadDropzone';

const meta: Meta<typeof UploadDropzone> = {
  title: 'AUDION/UploadDropzone',
  component: UploadDropzone,
  parameters: { layout: 'centered' },
};

export default meta;

type Story = StoryObj<typeof UploadDropzone>;

export const Idle: Story = {
  args: {
    onFileSelect: async (file) => console.log('Selected', file.name),
  },
};

export const Processing: Story = {
  args: {
    onFileSelect: async () => {},
    status: {
      label: 'Processing… 45%',
      progress: 45,
      variant: 'processing',
    },
  },
};

export const Success: Story = {
  args: {
    onFileSelect: async () => {},
    status: {
      label: 'Upload complete',
      progress: 100,
      variant: 'success',
    },
  },
};
