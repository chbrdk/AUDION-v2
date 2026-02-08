import type { Meta, StoryObj } from '@storybook/react';
import { KnowledgeExplorer } from './components/KnowledgeExplorer';

const mockChunks = [
  { id: '1', title: 'Competitive analysis Q1', source: 'report.pdf', tags: ['market', 'competitors'] },
  { id: '2', title: 'User interview notes', source: 'interviews.docx', tags: ['ux', 'feedback'] },
];

const meta: Meta<typeof KnowledgeExplorer> = {
  title: 'AUDION/KnowledgeExplorer',
  component: KnowledgeExplorer,
  parameters: { layout: 'centered' },
};

export default meta;

type Story = StoryObj<typeof KnowledgeExplorer>;

export const Default: Story = {
  args: { chunks: mockChunks, onChunkSelect: (c) => console.log(c) },
};

export const Empty: Story = {
  args: { chunks: [] },
};
