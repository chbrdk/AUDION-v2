import type { Meta, StoryObj } from '@storybook/react';
import { PersonaList } from './components/PersonaList';
import type { Persona } from './components/PersonaCard';

const mockPersonas: Persona[] = [
  { id: '1', name: 'Alex Researcher', segment: 'B2B SaaS', confidence: 0.92, headline: 'Focuses on competitive analysis.' },
  { id: '2', name: 'Sam Developer', segment: 'Tech', confidence: 0.88, headline: 'Technical decision maker.' },
];

const meta: Meta<typeof PersonaList> = {
  title: 'AUDION/PersonaList',
  component: PersonaList,
  parameters: { layout: 'centered' },
};

export default meta;

type Story = StoryObj<typeof PersonaList>;

export const Default: Story = {
  args: { personas: mockPersonas, onSelect: (id) => console.log(id) },
};

export const WithSelection: Story = {
  args: { personas: mockPersonas, selectedId: '1', onSelect: (id) => console.log(id) },
};

export const Empty: Story = {
  args: { personas: [] },
};
