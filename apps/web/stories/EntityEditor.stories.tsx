import type { Meta, StoryObj } from "@storybook/react";
import { MsqdxGlassEntityEditor } from "../components/generic";

const meta: Meta<typeof MsqdxGlassEntityEditor> = {
  title: "AUDION/EntityEditor",
  component: MsqdxGlassEntityEditor,
  parameters: { layout: "centered" },
};

export default meta;

type Story = StoryObj<typeof MsqdxGlassEntityEditor>;

const mockPersonaProfile = {
  full_name: "Alex Schmidt",
  gender: "male" as string | null,
  age: 35,
  location: "Berlin, Germany",
  media_affinity: 70,
};

export const PersonaDemographics: Story = {
  args: {
    entityType: "persona",
    entity: mockPersonaProfile,
    entitySyncKey: "storybook-persona-demographics",
    onSave: async (updates) => console.log("Save:", updates),
    inline: true,
    fieldOverrides: {
      name: undefined,
      headline: undefined,
      segment: undefined,
    },
  },
};
