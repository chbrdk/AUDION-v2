"use client";

import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  TextField, 
  Button 
} from "@mui/material";
import { MsqdxTypography } from "@msqdx/react";
import { THEME_ACCENT_WITH_FALLBACK } from "../../lib/theme-accent";
import { useState } from "react";

export type BugReportModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (description: string) => void;
};

export function BugReportModal({ open, onClose, onSubmit }: BugReportModalProps) {
  const [description, setDescription] = useState("");

  const handleSubmit = () => {
    onSubmit(description);
    setDescription("");
  };

  const handleClose = () => {
    onClose();
    setDescription("");
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          borderRadius: "16px",
          backgroundColor: THEME_ACCENT_WITH_FALLBACK.backgroundColor,
          border: `1px solid ${THEME_ACCENT_WITH_FALLBACK.borderColor}`,
          backgroundImage: "none",
        }
      }}
    >
      <DialogTitle sx={{ color: "white" }}>
        Report a Bug
      </DialogTitle>
      <DialogContent>
        <MsqdxTypography variant="body2" sx={{ color: "rgba(255, 255, 255, 0.7)", mb: 2 }}>
          Describe the issue you encountered. Please include steps to reproduce if possible.
        </MsqdxTypography>
        <TextField
          autoFocus
          multiline
          rows={4}
          fullWidth
          placeholder="Type your bug description here..."
          variant="outlined"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          sx={{
            "& .MuiOutlinedInput-root": {
              color: "white",
              "& fieldset": {
                borderColor: "rgba(255, 255, 255, 0.2)",
              },
              "&:hover fieldset": {
                borderColor: "rgba(255, 255, 255, 0.3)",
              },
              "&.Mui-focused fieldset": {
                borderColor: THEME_ACCENT_WITH_FALLBACK.borderColor,
              },
            },
          }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} sx={{ color: "rgba(255, 255, 255, 0.5)" }}>
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit} 
          disabled={!description.trim()}
          variant="contained"
          sx={{ 
              backgroundColor: THEME_ACCENT_WITH_FALLBACK.borderColor,
              "&:hover": {
                  backgroundColor: THEME_ACCENT_WITH_FALLBACK.borderColor,
                  opacity: 0.8
              }
          }}
        >
          Submit Report
        </Button>
      </DialogActions>
    </Dialog>
  );
}
