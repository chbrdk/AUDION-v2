"use client";

import { MsqdxUploadDropzone } from "@msqdx/react";

export type MsqdxGlassUploadDropzoneProps = {
  onFileSelect: (file: File) => Promise<void>;
  status?: {
    label: string;
    progress: number;
    variant: "idle" | "processing" | "success" | "error";
  };
};

export const MsqdxGlassUploadDropzone = ({
  onFileSelect,
  status,
}: MsqdxGlassUploadDropzoneProps) => (
  <MsqdxUploadDropzone
    onFileSelect={onFileSelect}
    status={
      status
        ? {
            label: status.label,
            progress: status.progress,
            variant: status.variant,
          }
        : undefined
    }
  />
);
