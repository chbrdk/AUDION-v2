"use client";

import { useCallback, useRef, useState } from "react";
import { alpha, Box, Button, LinearProgress, Stack, Typography, useTheme } from "@mui/material";
import { MaterialSymbol } from "./material-symbol";

type UdgGlassUploadDropzoneProps = {
  onFileSelect: (file: File) => Promise<void>;
  status?: {
    label: string;
    progress: number;
    variant: "idle" | "processing" | "success" | "error";
  };
};

export const UdgGlassUploadDropzone = ({ onFileSelect, status }: UdgGlassUploadDropzoneProps) => {
  const theme = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback(
    async (files?: FileList | null) => {
      if (!files || files.length === 0) {
        return;
      }
      await onFileSelect(files[0]);
    },
    [onFileSelect]
  );

  return (
    <Stack
      spacing={3}
      alignItems="center"
      justifyContent="center"
      sx={{
        border: "1px dashed var(--color-neutral)",
        borderRadius: 4,
        p: 6,
        textAlign: "center",
        cursor: "pointer",
        backgroundColor: isDragging
          ? alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.1 : 0.04)
          : theme.palette.background.paper,
        transition: "background-color 150ms ease",
        outline: "none"
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={async (event) => {
        event.preventDefault();
        setIsDragging(false);
        await handleFiles(event.dataTransfer?.files);
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
    >
      <MaterialSymbol icon="cloud_upload" fontSize={56} style={{ color: theme.palette.text.primary }} />
      <Stack spacing={1}>
        <Typography variant="h5">Drop your research</Typography>
        <Typography variant="body2">
          PDF, DOCX, PPTX, MP3 — we handle parsing, transcription, enrichment & embeddings
        </Typography>
      </Stack>
      <Button
        variant="contained"
        sx={{
          borderRadius: 999,
          backgroundColor: theme.palette.mode === "dark" ? "#ffffff" : "#000",
          color: theme.palette.mode === "dark" ? "#000" : "#fff",
          "&:hover": {
            backgroundColor: theme.palette.mode === "dark" ? "#e0e0e0" : "#111"
          }
        }}
      >
        Select file
      </Button>
      <input
        ref={inputRef}
        type="file"
        hidden
        accept=".pdf,.doc,.docx,.ppt,.pptx,.mp3,.wav,.m4a"
        onChange={async (event) => {
          await handleFiles(event.target.files);
          event.target.value = "";
        }}
      />
      {status && (
        <Stack spacing={1} sx={{ width: "100%", maxWidth: 420 }}>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
            {status.variant === "success" && (
              <MaterialSymbol icon="check_circle" fontSize={18} style={{ color: theme.palette.success.main }} />
            )}
            {status.variant === "error" && (
              <MaterialSymbol icon="error" fontSize={18} style={{ color: theme.palette.error.main }} />
            )}
            <Typography variant="body2">
              {status.label}
            </Typography>
          </Stack>
          {status.variant !== "success" && status.variant !== "error" && (
            <LinearProgress
              variant="determinate"
              value={status.progress}
              sx={{ borderRadius: 999, height: 8 }}
            />
          )}
        </Stack>
      )}
    </Stack>
  );
};

UdgGlassUploadDropzone.displayName = "udg-glass-upload-dropzone";

