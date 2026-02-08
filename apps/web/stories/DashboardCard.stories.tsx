import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { DashboardCard } from './components/DashboardCard';
import { DashboardCardSection } from './components/DashboardCardSection';
import { MsqdxTypography } from '@msqdx/react';

const meta: Meta<typeof DashboardCard> = {
  title: 'AUDION/DashboardCard',
  component: DashboardCard,
  parameters: { layout: 'centered' },
};

export default meta;

type Story = StoryObj<typeof DashboardCard>;

function Demo({ expanded: initial = true }) {
  const [expanded, setExpanded] = useState(initial);
  return (
    <div style={{ width: 360 }}>
      <DashboardCard
        id="card1"
        title="Basics"
        icon="person"
        iconColor={{ color: '#0a0' }}
        expanded={expanded}
        onToggle={() => setExpanded(!expanded)}
      >
        <DashboardCardSection title="Overview">
          <MsqdxTypography variant="body2">
            Persona basics and demographics.
          </MsqdxTypography>
        </DashboardCardSection>
      </DashboardCard>
    </div>
  );
}

export const Expanded: Story = {
  render: () => <Demo expanded={true} />,
};

export const Collapsed: Story = {
  render: () => <Demo expanded={false} />,
};
