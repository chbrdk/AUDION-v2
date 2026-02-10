"use client";

import type { ReactNode } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Box, Button, Typography } from "@mui/material";
import { MsqdxIcon } from "@msqdx/react";
import { useAuth } from "../auth/auth-provider";

export function ChatShareLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const search = searchParams.toString();
  const redirectPath = `${basePath}${pathname || "/chat"}${search ? `?${search}` : ""}`;

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

  if (!user) {
    router.replace(`${basePath}/login?redirect=${encodeURIComponent(redirectPath)}`);
    return null;
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--color-neutral, #0f172a)",
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
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <Button
          component={Link}
          href={`${basePath}/admin`}
          startIcon={<MsqdxIcon name="arrow_back" customSize={20} />}
          sx={{ textTransform: "none", color: "inherit" }}
        >
          Back to Admin
        </Button>
        <Typography variant="body2" sx={{ opacity: 0.7 }}>
          Shared Chat
        </Typography>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0 }}>{children}</Box>
    </Box>
  );
}
