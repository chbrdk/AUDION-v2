import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { KnowledgeSourcesCard } from './components/KnowledgeSourcesCard';

const meta: Meta<typeof KnowledgeSourcesCard> = {
  title: 'AUDION/KnowledgeSourcesCard',
  component: KnowledgeSourcesCard,
  parameters: { layout: 'centered' },
};

export default meta;

type Story = StoryObj<typeof KnowledgeSourcesCard>;

const mockSources = [
  { id: '1', title: 'report.pdf', status: 'processed' },
  { id: '2', title: 'interviews.docx', status: 'pending' },
];

function Demo({ expanded: initial }: { expanded: boolean }) {
  const [expanded, setExpanded] = useState(initial);
  return (
    <div style={{ width: 360 }}>
      <KnowledgeSourcesCard
        sources={mockSources}
        expanded={expanded}
        onToggle={() => setExpanded(!expanded)}
      />
    </div>
  );
}

export const WithSources: Story = { render: () => <Demo expanded={true} /> };
export const Empty: Story = {
  args: { sources: [], expanded: true, onToggle: () => {} },
  render: (args) => (
    <div style={{ width: 360 }}>
      <KnowledgeSourcesCard {...args} />
    </div>
  ),
};
