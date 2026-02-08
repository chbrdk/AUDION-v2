import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { BioCardEdit } from './components/BioCardEdit';

const meta: Meta<typeof BioCardEdit> = {
  title: 'AUDION/BioCardEdit',
  component: BioCardEdit,
  parameters: { layout: 'centered' },
};

export default meta;

type Story = StoryObj<typeof BioCardEdit>;

function Demo({ expanded: initial }: { expanded: boolean }) {
  const [expanded, setExpanded] = useState(initial);
  return (
    <div style={{ width: 360 }}>
      <BioCardEdit
        bio="Researcher focused on B2B and user interviews."
        expanded={expanded}
        onToggle={() => setExpanded(!expanded)}
        onSave={async (bio) => console.log('Save', bio)}
      />
    </div>
  );
}

export const Expanded: Story = { render: () => <Demo expanded={true} /> };
export const Collapsed: Story = { render: () => <Demo expanded={false} /> };
