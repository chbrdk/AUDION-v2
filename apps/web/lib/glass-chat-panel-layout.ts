import type { SxProps, Theme } from "@mui/material/styles";

/** Root message list stack in `MsqdxGlassChatPanel` (padding + extra bottom for scroll). */
export const glassChatPanelMessagesStackSx: SxProps<Theme> = {
  p: { xs: 1, md: 2.5 },
  pb: { md: "100px" },
};
