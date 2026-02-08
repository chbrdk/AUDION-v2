'use client';

import { MsqdxScrollbar, MsqdxChip, MsqdxTypography } from '@msqdx/react';
import { Box } from '@mui/material';

export type KnowledgeChunk = {
  id: string;
  title: string;
  source?: string;
  tags?: string[];
};

export type KnowledgeExplorerProps = {
  chunks: KnowledgeChunk[];
  onChunkSelect?: (chunk: KnowledgeChunk) => void;
};

export function KnowledgeExplorer({ chunks, onChunkSelect }: KnowledgeExplorerProps) {
  return (
    <MsqdxScrollbar sx={{ maxHeight: 400 }}>
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {chunks.length === 0 ? (
          <MsqdxTypography variant="body2" color="text.secondary">
            No knowledge chunks.
          </MsqdxTypography>
        ) : (
          chunks.map((chunk) => (
            <Box
              key={chunk.id}
              sx={{
                p: 1.5,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                cursor: onChunkSelect ? 'pointer' : 'default',
              }}
              onClick={() => onChunkSelect?.(chunk)}
            >
              <MsqdxTypography variant="subtitle2">{chunk.title}</MsqdxTypography>
              {chunk.source && (
                <MsqdxTypography variant="caption" color="text.secondary">
                  {chunk.source}
                </MsqdxTypography>
              )}
              {chunk.tags && chunk.tags.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                  {chunk.tags.map((tag) => (
                    <MsqdxChip key={tag} label={tag} size="small" />
                  ))}
                </Box>
              )}
            </Box>
          ))
        )}
      </Box>
    </MsqdxScrollbar>
  );
}
