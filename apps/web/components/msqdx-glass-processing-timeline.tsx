"use client";

import { alpha, Box, Stack, Typography, useTheme } from "@mui/material";
import { MaterialSymbol } from "./material-symbol";

const STAGES = [
  {
    icon: "graphic_eq",
    title: "Transcribe & parse",
    description: "Unstructured + Whisper-large-v3-turbo",
    key: "transcribe"
  },
  {
    icon: "insights",
    title: "NLP enrichment",
    description: "spaCy 3.8 + entity graphs",
    key: "enrich"
  },
  {
    icon: "auto_awesome",
    title: "Embeddings",
    description: "BGE-M3 v1.5 chunking",
    key: "embed"
  },
  {
    icon: "storage",
    title: "Vector & graph persist",
    description: "Qdrant + Neo4j dual-write",
    key: "persist"
  }
];

export type MsqdxGlassProcessingTimelineProps = {
  activeStage?: string;
};

export const MsqdxGlassProcessingTimeline = ({ activeStage }: MsqdxGlassProcessingTimelineProps) => {
  const theme = useTheme();
  return (
    <Stack spacing={2}>
      {STAGES.map((stage, index) => {
        const isActive = activeStage === stage.key;
        return (
          <Stack
            key={stage.key}
            direction="row"
            spacing={2}
            alignItems="center"
            sx={{
              p: 2,
              borderRadius: 2,
              backgroundColor: alpha(
                theme.palette.text.primary,
                isActive
                  ? theme.palette.mode === "dark"
                    ? 0.12
                    : 0.06
                  : theme.palette.mode === "dark"
                  ? 0.04
                  : 0.02
              ),
              border: "1px solid var(--color-neutral)"
            }}
          >
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: alpha(theme.palette.text.primary, 0.08),
                color: theme.palette.text.primary
              }}
            >
              <MaterialSymbol icon={stage.icon} fontSize={20} />
            </Box>
            <Box>
              <Typography variant="subtitle1">
                {index + 1}. {stage.title}
              </Typography>
              <Typography variant="body2">
                {stage.description}
              </Typography>
            </Box>
          </Stack>
        );
      })}
    </Stack>
  );
};

MsqdxGlassProcessingTimeline.displayName = "msqdx-glass-processing-timeline";

