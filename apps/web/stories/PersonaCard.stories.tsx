import type { Meta, StoryObj } from '@storybook/react';
import { PersonaCard, type Persona } from './components/PersonaCard';

const mockPersona: Persona = {
  id: '1',
  name: 'Alex Researcher',
  segment: 'B2B SaaS',
  confidence: 0.92,
  headline: 'Focuses on competitive analysis and user interviews.',
};

const meta: Meta<typeof PersonaCard> = {
  title: 'AUDION/PersonaCard',
  component: PersonaCard,
  parameters: { layout: 'centered' },
};

export default meta;

type Story = StoryObj<typeof PersonaCard>;

export const Default: Story = {
  args: {
    persona: mockPersona,
    actionLabel: 'Chat',
  },
};

export const Selected: Story = {
  args: {
    persona: mockPersona,
    selected: true,
    actionLabel: 'Chat',
  },
};

export const WithImage: Story = {
  args: {
    persona: {
      ...mockPersona,
      image_url: 'https://i.pravatar.cc/128?u=persona1',
    },
  },
};
