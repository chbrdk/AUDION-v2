import type { Meta, StoryObj } from '@storybook/react';
import { ProcessingTimeline } from './components/ProcessingTimeline';

const meta: Meta<typeof ProcessingTimeline> = {
  title: 'AUDION/ProcessingTimeline',
  component: ProcessingTimeline,
  parameters: { layout: 'centered' },
};

export default meta;

type Story = StoryObj<typeof ProcessingTimeline>;

export const Default: Story = {};

export const ActiveEnrich: Story = { args: { activeStage: 'enrich' } };
