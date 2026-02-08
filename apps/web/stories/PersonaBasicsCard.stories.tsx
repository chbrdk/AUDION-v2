import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { PersonaBasicsCard } from './components/PersonaBasicsCard';

const meta: Meta<typeof PersonaBasicsCard> = {
  title: 'AUDION/PersonaBasicsCard',
  component: PersonaBasicsCard,
  parameters: { layout: 'centered' },
};

export default meta;

type Story = StoryObj<typeof PersonaBasicsCard>;

function Demo() {
  const [expanded, setExpanded] = useState(true);
  return (
    <div style={{ width: 360 }}>
      <PersonaBasicsCard
        name="Alex Researcher"
        headline="B2B research lead"
        segment="B2B SaaS"
        status="draft"
        expanded={expanded}
        onToggle={() => setExpanded(!expanded)}
      />
    </div>
  );
}

export const Default: Story = { render: () => <Demo /> };
