"use client";

import Image from "next/image";
import { alpha, Avatar, Box, Button, Card, CardContent, Stack, Typography, useTheme } from "@mui/material";
import { MaterialSymbol } from "./material-symbol";

type Persona = {
  id: string;
  name: string;
  segment: string;
  confidence: number;
  headline: string;
  image_url?: string | null;
};

type MsqdxGlassPersonaCardProps = {
  persona: Persona;
  selected?: boolean;
  onSelect?: (personaId: string) => void;
  actionLabel?: string;
};

export const MsqdxGlassPersonaCard = ({
  persona,
  selected,
  onSelect,
  actionLabel = "Chat"
}: MsqdxGlassPersonaCardProps) => {
  const theme = useTheme();
  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 4,
        borderColor: "var(--color-neutral)",
        background: selected
          ? alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.1 : 0.05)
          : theme.palette.background.paper,
        transition: "all 150ms ease"
      }}
    >
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2} alignItems="center">
            {persona.image_url ? (
              <Avatar
                src={persona.image_url}
                alt={persona.name}
                sx={{ width: 64, height: 64 }}
              >
                {persona.name.charAt(0)}
              </Avatar>
            ) : (
              <Avatar sx={{ width: 64, height: 64, bgcolor: theme.palette.primary.main }}>
                {persona.name.charAt(0)}
              </Avatar>
            )}
            <Stack spacing={0.5} flex={1}>
              <Typography variant="h6">{persona.name}</Typography>
              <Typography variant="body2">{persona.segment}</Typography>
              <Typography variant="body2">
                Confidence: {(persona.confidence * 100).toFixed(0)}%
              </Typography>
            </Stack>
          </Stack>
          <Typography variant="body2">{persona.headline}</Typography>
          <Button
            variant="contained"
            startIcon={
              <MaterialSymbol icon={selected ? "chat" : "swap_horiz"} fontSize={20} />
            }
            onClick={() => onSelect?.(persona.id)}
            sx={{
              borderRadius: 999,
              backgroundColor: theme.palette.mode === "dark" ? "#ffffff" : "#000",
              color: theme.palette.mode === "dark" ? "#000" : "#fff",
              "&:hover": {
                backgroundColor: theme.palette.mode === "dark" ? "#e0e0e0" : "#111"
              }
            }}
          >
            {selected ? "Live" : actionLabel}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
};

MsqdxGlassPersonaCard.displayName = "msqdx-glass-persona-card";

