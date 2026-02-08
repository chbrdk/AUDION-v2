'use client';

import { useCallback, useRef, useState } from 'react';
import { MsqdxButton, MsqdxTypography, MsqdxIcon } from '@msqdx/react';
import { Box } from '@mui/material';

export type UploadDropzoneStatus = {
  label: string;
  progress: number;
  variant: 'idle' | 'processing' | 'success' | 'error';
};

export type UploadDropzoneProps = {
  onFileSelect: (file: File) => Promise<void>;
  status?: UploadDropzoneStatus;
};

export function UploadDropzone({ onFileSelect, status }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback(
    async (files?: FileList | null) => {
      if (!files?.length) return;
      await onFileSelect(files[0]);
    },
    [onFileSelect]
  );

  return (
    <Box
      sx={{
        border: '1px dashed',
        borderColor: 'divider',
        borderRadius: 2,
        p: 4,
        textAlign: 'center',
        cursor: 'pointer',
        bgcolor: isDragging ? 'action.hover' : 'background.paper',
        transition: 'background-color 150ms ease',
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={async (e) => {
        e.preventDefault();
        setIsDragging(false);
        await handleFiles(e.dataTransfer?.files);
      }}
      onClick={() => inputRef.current?.click()}
      component="div"
      role="button"
    >
      <input
        ref={inputRef}
        type="file"
        hidden
        accept=".pdf,.docx,.pptx,.mp3"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Box sx={{ mb: 1 }}>
        <MsqdxIcon name="cloud_upload" customSize={56} />
      </Box>
      <MsqdxTypography variant="h6">Drop your research</MsqdxTypography>
      <MsqdxTypography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        PDF, DOCX, PPTX, MP3 — we handle parsing, transcription, enrichment & embeddings
      </MsqdxTypography>
      <MsqdxButton brandColor="green" sx={{ mt: 2 }}>
        Select file
      </MsqdxButton>
      {status && status.variant !== 'idle' && (
        <Box mt={2}>
          <MsqdxTypography variant="body2">{status.label}</MsqdxTypography>
          {status.variant === 'processing' && (
            <Box sx={{ width: '100%', mt: 1, bgcolor: 'divider', borderRadius: 1, height: 8, overflow: 'hidden' }}>
              <Box
                sx={{
                  width: `${status.progress}%`,
                  height: '100%',
                  bgcolor: 'primary.main',
                  transition: 'width 200ms',
                }}
              />
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
