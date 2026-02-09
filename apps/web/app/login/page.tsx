"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Box, Button, Card, CardContent, Stack, TextField, Typography } from "@mui/material";

import { ThemeRegistryNoSSR } from "../../components/theme-registry-no-ssr";
import { buildApiUrl } from "../api/_lib/backend";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const redirectTo = searchParams.get("redirect") || "/admin";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(buildApiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || data.error || "Login failed");
      }
      const resolvedRedirect = redirectTo.startsWith("/")
        ? `${basePath}${redirectTo}`
        : `${basePath}/${redirectTo}`;
      router.replace(resolvedRedirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemeRegistryNoSSR>
      <Box
        component="main"
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: 3,
          background:
            "radial-gradient(circle at 20% 20%, rgba(90,232,255,0.15), transparent 40%), radial-gradient(circle at 80% 0%, rgba(254,122,255,0.12), transparent 35%)",
        }}
      >
        <Card sx={{ maxWidth: 420, width: "100%", borderRadius: 4 }}>
          <CardContent>
            <Stack spacing={3}>
              <Box>
                <Typography variant="h4" fontWeight={700}>
                  Welcome back
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Sign in to manage your projects and personas.
                </Typography>
              </Box>
              {error && (
                <Box sx={{ p: 2, borderRadius: 2, bgcolor: "rgba(239, 68, 68, 0.12)" }}>
                  <Typography variant="body2" color="error">
                    {error}
                  </Typography>
                </Box>
              )}
              <form onSubmit={handleSubmit}>
                <Stack spacing={2}>
                  <TextField
                    label="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    fullWidth
                  />
                  <TextField
                    label="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    fullWidth
                  />
                  <Button type="submit" variant="contained" disabled={loading}>
                    {loading ? "Signing in..." : "Sign in"}
                  </Button>
                </Stack>
              </form>
              <Typography variant="body2" color="text.secondary">
                New here?{" "}
                <Link href="/register" style={{ color: "inherit", fontWeight: 600 }}>
                  Create an account
                </Link>
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </ThemeRegistryNoSSR>
  );
}
