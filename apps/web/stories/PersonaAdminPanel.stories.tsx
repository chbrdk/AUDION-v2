import type { Meta, StoryObj } from '@storybook/react';
import { PersonaAdminPanel } from './components/PersonaAdminPanel';
import type { Persona } from './components/PersonaCard';

const mockPersonas: Persona[] = [
  { id: '1', name: 'Alex', segment: 'B2B', confidence: 0.9, headline: 'Researcher.' },
];

const meta: Meta<typeof PersonaAdminPanel> = {
  title: 'AUDION/PersonaAdminPanel',
  component: PersonaAdminPanel,
  parameters: { layout: 'centered' },
};

export default meta;

type Story = StoryObj<typeof PersonaAdminPanel>;

export const Default: Story = {
  args: { personas: mockPersonas, onSelectPersona: (id) => console.log(id) },
};

export const Empty: Story = {
  args: { personas: [] },
};
