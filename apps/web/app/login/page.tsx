"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Box, Stack } from "@mui/material";
import {
  MsqdxButton,
  MsqdxFormField,
  MsqdxMoleculeCard,
  MsqdxLogo,
  MsqdxTypography,
} from "@msqdx/react";

import { ThemeRegistryNoSSR } from "../../components/theme-registry-no-ssr";
import { useI18n } from "../../components/i18n/i18n-provider";
import { buildApiUrl } from "../api/_lib/backend";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const redirectTo = searchParams.get("redirect") || "/admin";
  const { t } = useI18n();

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
        throw new Error(data.detail || data.error || t("auth.login.error"));
      }
      const resolvedRedirect = redirectTo.startsWith("/")
        ? `${basePath}${redirectTo}`
        : `${basePath}/${redirectTo}`;
      router.replace(resolvedRedirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.login.error"));
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
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          px: 3,
          py: 4,
          background:
            "radial-gradient(circle at 20% 20%, rgba(90,232,255,0.15), transparent 40%), radial-gradient(circle at 80% 0%, rgba(254,122,255,0.12), transparent 35%)",
        }}
      >
        <Stack spacing={3} alignItems="center" sx={{ width: "100%", maxWidth: 420 }}>
          <MsqdxLogo size="large" color="black" sx={{ mb: 1 }} />

          <MsqdxMoleculeCard
            variant="flat"
            borderRadius="button"
            sx={{
              width: "100%",
              p: 3,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Stack spacing={3}>
              <Box>
                <MsqdxTypography variant="h4" weight="bold">
                  {t("auth.login.title")}
                </MsqdxTypography>
                <MsqdxTypography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {t("auth.login.subtitle")}
                </MsqdxTypography>
              </Box>

              {error && (
                <Box sx={{ p: 2, borderRadius: 2, bgcolor: "error.light" }}>
                  <MsqdxTypography variant="body2" sx={{ color: "error.contrastText" }}>
                    {error}
                  </MsqdxTypography>
                </Box>
              )}

              <Box component="form" onSubmit={handleSubmit}>
                <Stack spacing={2}>
                  <MsqdxFormField
                    label={t("auth.login.email")}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    fullWidth
                  />
                  <MsqdxFormField
                    label={t("auth.login.password")}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    fullWidth
                  />
                  <MsqdxButton
                    type="submit"
                    variant="contained"
                    disabled={loading}
                    fullWidth
                    sx={{ mt: 0.5 }}
                  >
                    {loading ? t("auth.login.ctaLoading") : t("auth.login.cta")}
                  </MsqdxButton>
                </Stack>
              </Box>

              <MsqdxTypography variant="body2" color="text.secondary">
                {t("auth.login.prompt")}{" "}
                <Link href="/register" style={{ color: "inherit", fontWeight: 600 }}>
                  {t("auth.login.link")}
                </Link>
              </MsqdxTypography>
            </Stack>
          </MsqdxMoleculeCard>
        </Stack>
      </Box>
    </ThemeRegistryNoSSR>
  );
}
