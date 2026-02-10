"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Box, Button, Typography } from "@mui/material";
import { MsqdxIcon } from "@msqdx/react";
import { useAuth } from "../auth/auth-provider";

export function ChatShareLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "var(--color-neutral, #0f172a)",
        }}
      >
        <Typography color="text.secondary">Loading…</Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--color-neutral)",
        color: "var(--color-text-primary)",
      }}
    >
      <Box
        component="header"
        sx={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 2,
          py: 1.5,
          borderBottom: "1px solid var(--color-neutral)",
          backgroundColor: "var(--color-neutral)",
        }}
      >
        <Button
          component={Link}
          href={user ? `${basePath}/admin` : `${basePath}/login`}
          startIcon={<MsqdxIcon name={user ? "arrow_back" : "login"} customSize={20} />}
          sx={{
            textTransform: "none",
            color: "var(--color-text-primary)",
            "&:hover": { backgroundColor: "rgba(255,255,255,0.08)" },
          }}
        >
          {user ? "Back to Admin" : "Sign in"}
        </Button>
        <Typography variant="body2" sx={{ color: "var(--color-text-secondary)", fontWeight: 500 }}>
          Chat
        </Typography>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0 }}>{children}</Box>
    </Box>
  );
}
