"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Box, Button, Card, CardContent, Stack, TextField, Typography } from "@mui/material";

import { ThemeRegistryNoSSR } from "../../components/theme-registry-no-ssr";
import { useI18n } from "../../components/i18n/i18n-provider";
import { buildApiUrl } from "../api/_lib/backend";

export default function RegisterPage() {
  const router = useRouter();
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const { t } = useI18n();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(buildApiUrl("/api/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name || undefined, email, password }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || data.error || t("auth.register.error"));
      }
      router.replace(`${basePath}/admin`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.register.error"));
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
            "radial-gradient(circle at 20% 20%, rgba(56,189,248,0.12), transparent 45%), radial-gradient(circle at 70% 0%, rgba(217,70,239,0.12), transparent 40%)",
        }}
      >
        <Card sx={{ maxWidth: 440, width: "100%", borderRadius: 4 }}>
          <CardContent>
            <Stack spacing={3}>
              <Box>
                <Typography variant="h4" fontWeight={700}>
                  {t("auth.register.title")}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t("auth.register.subtitle")}
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
                    label={t("auth.register.name")}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    fullWidth
                  />
                  <TextField
                    label={t("auth.register.email")}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    fullWidth
                  />
                  <TextField
                    label={t("auth.register.password")}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    fullWidth
                  />
                  <Button type="submit" variant="contained" disabled={loading}>
                    {loading ? t("auth.register.ctaLoading") : t("auth.register.cta")}
                  </Button>
                </Stack>
              </form>
              <Typography variant="body2" color="text.secondary">
                {t("auth.register.prompt")}{" "}
                <Link href="/login" style={{ color: "inherit", fontWeight: 600 }}>
                  {t("auth.register.link")}
                </Link>
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </ThemeRegistryNoSSR>
  );
}
