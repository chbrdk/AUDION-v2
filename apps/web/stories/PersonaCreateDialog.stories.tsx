import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { PersonaCreateDialog } from './components/PersonaCreateDialog';
import { MsqdxButton } from '@msqdx/react';

const meta: Meta<typeof PersonaCreateDialog> = {
  title: 'AUDION/PersonaCreateDialog',
  component: PersonaCreateDialog,
  parameters: { layout: 'centered' },
};

export default meta;

type Story = StoryObj<typeof PersonaCreateDialog>;

function Demo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <MsqdxButton onClick={() => setOpen(true)}>Open dialog</MsqdxButton>
      <PersonaCreateDialog
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={async (req) => {
          console.log('Submit', req);
          await new Promise((r) => setTimeout(r, 500));
        }}
      />
    </>
  );
}

export const Default: Story = {
  render: () => <Demo />,
};
