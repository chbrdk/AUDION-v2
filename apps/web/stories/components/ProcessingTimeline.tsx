'use client';

import { MsqdxCard, MsqdxTypography, MsqdxIcon } from '@msqdx/react';
import { Box } from '@mui/material';

const STAGES = [
  { icon: 'graphic_eq', title: 'Transcribe & parse', description: 'Unstructured + Whisper', key: 'transcribe' },
  { icon: 'insights', title: 'NLP enrichment', description: 'spaCy + entity graphs', key: 'enrich' },
  { icon: 'auto_awesome', title: 'Embeddings', description: 'BGE-M3 chunking', key: 'embed' },
  { icon: 'storage', title: 'Vector & graph persist', description: 'Qdrant + Neo4j', key: 'persist' },
];

export type ProcessingTimelineProps = { activeStage?: string };

export function ProcessingTimeline({ activeStage }: ProcessingTimelineProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {STAGES.map((stage, index) => {
        const isActive = activeStage === stage.key;
        return (
          <MsqdxCard
            key={stage.key}
            sx={{
              p: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              bgcolor: isActive ? 'action.selected' : 'background.paper',
            }}
          >
            <Box sx={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'action.hover' }}>
              <MsqdxIcon name={stage.icon as any} size="sm" />
            </Box>
            <Box>
              <MsqdxTypography variant="subtitle1">{index + 1}. {stage.title}</MsqdxTypography>
              <MsqdxTypography variant="body2" color="text.secondary">{stage.description}</MsqdxTypography>
            </Box>
          </MsqdxCard>
        );
      })}
    </Box>
  );
}
