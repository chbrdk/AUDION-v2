"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Box, Stack } from "@mui/material";
import {
  MsqdxButton,
  MsqdxFormField,
  MsqdxMoleculeCard,
  MsqdxLogo,
  MsqdxTypography,
} from "@msqdx/react";
import { MSQDX_TYPOGRAPHY } from "@msqdx/tokens";

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
          flexDirection: "row",
          bgcolor: "var(--color-secondary-dx-green)",
        }}
      >
        {/* Left 70%: Logo + AUDION headline */}
        <Box
          sx={{
            flex: "0 0 70%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            px: 4,
          }}
        >
          <Stack direction="row" alignItems="center">
            <MsqdxLogo width={220} height={53} color="white" />
            <MsqdxTypography variant="h4" weight="light" sx={{ color: "white", fontSize: "2.25rem", ml: "36px" }}>
              AUDION
            </MsqdxTypography>
          </Stack>
        </Box>

        {/* Right 30%: Register card */}
        <Box
          sx={{
            flex: "0 0 30%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            px: 3,
            py: 4,
          }}
        >
          <MsqdxMoleculeCard
            variant="flat"
            borderRadius="button"
            sx={{
              width: "100%",
              maxWidth: 360,
              p: 3,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Stack spacing={3}>
              <Box>
                <MsqdxTypography variant="h4" weight="bold" sx={{ fontFamily: MSQDX_TYPOGRAPHY.fontFamily.mono }}>
                  {t("auth.register.title")}
                </MsqdxTypography>
                <MsqdxTypography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {t("auth.register.subtitle")}
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
                    label={t("auth.register.name")}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    fullWidth
                  />
                  <MsqdxFormField
                    label={t("auth.register.email")}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    fullWidth
                  />
                  <MsqdxFormField
                    label={t("auth.register.password")}
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
                    {loading ? t("auth.register.ctaLoading") : t("auth.register.cta")}
                  </MsqdxButton>
                </Stack>
              </Box>

              <MsqdxTypography variant="body2" color="text.secondary">
                {t("auth.register.prompt")}{" "}
                <Link href="/login" style={{ color: "inherit", fontWeight: 600 }}>
                  {t("auth.register.link")}
                </Link>
              </MsqdxTypography>
            </Stack>
          </MsqdxMoleculeCard>
        </Box>
      </Box>
    </ThemeRegistryNoSSR>
  );
}
