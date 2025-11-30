"use client";

import Link from "next/link";
import { Box, Button, Stack, Typography } from "@mui/material";
import { MaterialSymbol } from "../components/material-symbol";

const UdgGlassLandingHero = () => {
  return (
    <Stack spacing={4} alignItems="center" textAlign="center" sx={{ py: 12 }}>
      <Typography variant="h2" fontWeight={600}>
        Audion
      </Typography>
      <Typography variant="h6" maxWidth={640}>
        Upload your raw research, let AI discover personas live, and jump into contextual
        conversations with their authentic voices.
      </Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <Button
          component={Link}
          href="/upload"
          variant="contained"
          startIcon={<MaterialSymbol icon="upload_file" fontSize={20} />}
          sx={{ borderRadius: 999 }}
        >
          Upload Research
        </Button>
        <Button
          component={Link}
          href="/chat"
          variant="outlined"
          startIcon={<MaterialSymbol icon="chat_bubble" fontSize={20} />}
          sx={{ borderRadius: 999 }}
        >
          Peek the Chat
        </Button>
      </Stack>
    </Stack>
  );
};

UdgGlassLandingHero.displayName = "udg-glass-landing-hero";

export default function Home() {
  return (
    <Box
      component="main"
      sx={{
        px: { xs: 3, md: 8 },
        background:
          "radial-gradient(circle at 20% 20%, rgba(90,232,255,0.15), transparent 40%), radial-gradient(circle at 80% 0%, rgba(254,122,255,0.12), transparent 35%)"
      }}
    >
      <UdgGlassLandingHero />
    </Box>
  );
}

