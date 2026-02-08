"use client";

import { useEffect, useState } from "react";
import { Box } from "@mui/material";
import { MsqdxIcon, MsqdxSnackbar, MsqdxButton } from "@msqdx/react";

export type MsqdxGlassInlineEditControlsProps = {
  hasChanges: boolean;
  saving?: boolean;
  onSave: () => void | Promise<void>;
  onDiscard: () => void;
  anchorElement?: HTMLElement | null;
  position?: "top" | "bottom" | "left" | "right";
};

export const MsqdxGlassInlineEditControls = ({
  hasChanges,
  saving = false,
  onSave,
  onDiscard,
}: MsqdxGlassInlineEditControlsProps) => {
  const [showControls, setShowControls] = useState(false);

  useEffect(() => {
    if (!hasChanges) {
      setShowControls(false);
      return;
    }
    const timer = setTimeout(() => setShowControls(true), 150);
    return () => clearTimeout(timer);
  }, [hasChanges]);

  const handleSave = async () => {
    await onSave();
  };

  const handleClose = (_event: React.SyntheticEvent | Event, reason: string) => {
    if (reason === "clickaway" || reason === "escapeKeyDown") {
      onDiscard();
    }
  };

  const action = (
    <Box sx={{ display: "flex", gap: 0.5 }}>
      <MsqdxButton
        variant="contained"
        size="small"
        onClick={handleSave}
        disabled={saving}
        startIcon={<MsqdxIcon name={saving ? "hourglass_empty" : "check"} customSize={18} />}
        brandColor="purple"
      >
        Save
      </MsqdxButton>
      <MsqdxButton
        variant="outlined"
        size="small"
        onClick={onDiscard}
        disabled={saving}
        startIcon={<MsqdxIcon name="close" customSize={18} />}
        brandColor="purple"
      >
        Discard
      </MsqdxButton>
    </Box>
  );

  return (
    <MsqdxSnackbar
      open={showControls && hasChanges}
      onClose={handleClose}
      message="Unsaved changes"
      action={action}
      autoHideDuration={null}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      variant="outlined"
      brandColor="purple"
      sx={{
        padding: "6px 10px",
        flexDirection: "row",
        alignItems: "center",
        gap: 1,
        "& .MuiSnackbarContent-message": { flex: 1, padding: 0 },
        "& .MuiSnackbarContent-action": {
          marginTop: 0,
          marginBottom: 0,
          marginRight: 0,
          paddingLeft: 0,
          alignSelf: "center",
        },
      }}
    />
  );
};
