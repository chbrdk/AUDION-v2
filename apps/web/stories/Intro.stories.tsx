import type { Meta, StoryObj } from '@storybook/react';
import { MsqdxButton, MsqdxCard, MsqdxIcon, MsqdxTypography } from '@msqdx/react';

const meta: Meta = {
  title: 'AUDION/Intro',
  parameters: {
    layout: 'centered',
  },
};

export default meta;

type Story = StoryObj;

export const DSComponents: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start' }}>
      <MsqdxTypography variant="h4">AUDION Storybook</MsqdxTypography>
      <MsqdxTypography variant="body2" color="text.secondary">
        Components built only with @msqdx/react and @msqdx/tokens.
      </MsqdxTypography>
      <MsqdxButton brandColor="green">Button</MsqdxButton>
      <MsqdxCard sx={{ p: 2, minWidth: 200 }}>
        <MsqdxTypography variant="body2">Card with icon</MsqdxTypography>
        <MsqdxIcon name="person" size="sm" />
      </MsqdxCard>
    </div>
  ),
};
