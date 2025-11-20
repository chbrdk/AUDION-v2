"use client";

import { useCallback, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Divider,
  Stack,
  Typography,
  useTheme
} from "@mui/material";
import { UdgGlassUploadDropzone } from "../../components/udg-glass-upload-dropzone";
import { UdgGlassProcessingTimeline } from "../../components/udg-glass-processing-timeline";
import { pollUploadStatus, uploadResearch } from "../../lib/uploads";

type UploadStatus =
  | { label: string; progress: number; variant: "idle" }
  | { label: string; progress: number; variant: "processing" }
  | { label: string; progress: number; variant: "success" }
  | { label: string; progress: number; variant: "error" };

const INITIAL_STATUS: UploadStatus = {
  label: "Idle",
  progress: 0,
  variant: "idle"
};

export default function UploadPage() {
  const theme = useTheme();
  const [status, setStatus] = useState<UploadStatus>(INITIAL_STATUS);
  const [activeStage, setActiveStage] = useState<string | undefined>();

  const handleFileSelect = useCallback(
    async (file: File) => {
      setStatus({ label: "Uploading…", progress: 15, variant: "processing" });
      try {
        const response = await uploadResearch(file);
        const job_id = response.job_id;

        if (!job_id) {
          throw new Error("No job ID received from server");
        }

        const poll = async () => {
          const job = await pollUploadStatus(job_id);
          if (job.status === "processing") {
            setStatus({
              label: `Processing… ${job.progress}%`,
              progress: job.progress,
              variant: "processing"
            });
            if (job.progress < 30) {
              setActiveStage("transcribe");
            } else if (job.progress < 55) {
              setActiveStage("enrich");
            } else if (job.progress < 80) {
              setActiveStage("embed");
            } else {
              setActiveStage("persist");
            }
            setTimeout(poll, 1500);
          } else if (job.status === "completed") {
            setStatus({
              label: `Processing complete · ${job.document_id}`,
              progress: 100,
              variant: "success"
            });
            setActiveStage(undefined);
          } else {
            setStatus({
              label: job.reason ?? "Processing failed",
              progress: 100,
              variant: "error"
            });
            setActiveStage(undefined);
          }
        };

        await poll();
      } catch (error) {
        setStatus({
          label: (error as Error).message ?? "Upload failed",
          progress: 100,
          variant: "error"
        });
      }
    },
    []
  );

  return (
    <Box component="main" sx={{ px: { xs: 2, md: 6 }, py: 8 }}>
      <Card
        sx={{
          borderRadius: 5,
          backgroundColor: theme.palette.background.paper,
          border: "1px solid var(--color-neutral)"
        }}
      >
        <CardContent>
          <Stack spacing={4}>
            <Stack spacing={1}>
              <Typography variant="h4" fontWeight={600}>
                Upload your research
              </Typography>
              <Typography variant="body1">
                We orchestrate Unstructured, Whisper, spaCy, BGE-M3, and Qdrant in a single async
                pipeline. Typical turnaround: 2–5 minutes.
              </Typography>
            </Stack>
            <UdgGlassUploadDropzone onFileSelect={handleFileSelect} status={status} />
            <Divider />
            <Stack spacing={2}>
              <Typography variant="subtitle1">Processing timeline</Typography>
              <UdgGlassProcessingTimeline activeStage={activeStage} />
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

