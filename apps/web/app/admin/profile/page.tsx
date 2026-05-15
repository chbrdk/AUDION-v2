"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Avatar, Box, Divider, Stack } from "@mui/material";
import { useRouter } from "next/navigation";
import {
  MsqdxButton,
  MsqdxCard,
  MsqdxFormField,
  MsqdxSelect,
  MsqdxTypography,
} from "@msqdx/react";

import { useAuth } from "../../../components/auth/auth-provider";
import { useI18n } from "../../../components/i18n/i18n-provider";
import { BrandColorSelector } from "../../../components/settings/brand-color-selector";
import { ThemeModeSelector } from "../../../components/settings/theme-mode-selector";
import { useThemeMode } from "../../../components/theme-registry";
import { FORM_FIELD_ACCENT_SX } from "../../../lib/theme-accent";
import { API_AUTH_TOKENS, apiAuthTokenRevoke } from "../../api/_lib/backend";

export default function ProfilePage() {
  const router = useRouter();
  const { user, updateProfile, changePassword, logout } = useAuth();
  const { t, setLocale: setUiLocale } = useI18n();
  const { themeMode } = useThemeMode();

  const languageOptions = [
    { value: "de", label: "Deutsch" },
    { value: "en", label: "English" },
  ];

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [locale, setLocale] = useState("en");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  type ApiTokenRow = { id: string; name?: string; createdAt: string };
  const [apiTokens, setApiTokens] = useState<ApiTokenRow[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [creatingToken, setCreatingToken] = useState(false);
  const [tokenName, setTokenName] = useState("");
  const [newToken, setNewToken] = useState<string | null>(null);

  const fetchApiTokens = useCallback(() => {
    setLoadingTokens(true);
    fetch(API_AUTH_TOKENS, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data?.data)) setApiTokens(data.data);
      })
      .catch(() => setApiTokens([]))
      .finally(() => setLoadingTokens(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    setName(user.name ?? "");
    setEmail(user.email ?? "");
    setCompany(user.company ?? "");
    setAvatarUrl(user.avatar_url ?? "");
    setLocale(user.locale ?? "en");
  }, [user]);

  useEffect(() => {
    if (!user?.id) return;
    fetchApiTokens();
  }, [user?.id, fetchApiTokens]);

  const initials = useMemo(() => {
    const base = (name || user?.email || "A").trim();
    return base
      .split(/\s+/)
      .map((part) => part[0]?.toUpperCase())
      .filter(Boolean)
      .slice(0, 2)
      .join("");
  }, [name, user?.email]);

  const handleSaveProfile = async () => {
    setError(null);
    setSuccess(null);
    setSavingProfile(true);
    try {
      await updateProfile({
        name: name.trim() || undefined,
        email: email.trim() || undefined,
        company: company.trim() || undefined,
        avatar_url: avatarUrl.trim() || null,
        locale: locale || null,
      });
      setSuccess(t("profile.messages.profileUpdated"));
      setUiLocale(locale);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("profile.messages.profileUpdateFailed"));
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordUpdate = async () => {
    setError(null);
    setSuccess(null);
    if (!currentPassword || !newPassword) {
      setError(t("profile.messages.passwordMissing"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("profile.messages.passwordMismatch"));
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword({ current_password: currentPassword, new_password: newPassword });
      setSuccess(t("profile.messages.passwordUpdated"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("profile.messages.passwordUpdateFailed"));
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
    router.replace(`${basePath}/login`);
  };

  const handleCreateToken = async () => {
    setError(null);
    setCreatingToken(true);
    try {
      const res = await fetch(API_AUTH_TOKENS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: tokenName.trim() || undefined }),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? t("profile.apiTokens.errorCreate"));
      setNewToken((data as { token: string }).token);
      setTokenName("");
      fetchApiTokens();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("profile.apiTokens.errorCreate"));
    } finally {
      setCreatingToken(false);
    }
  };

  const handleRevokeToken = async (id: string) => {
    if (!window.confirm(t("profile.apiTokens.revokeConfirm"))) return;
    setError(null);
    try {
      const res = await fetch(apiAuthTokenRevoke(id), { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Failed");
      }
      setApiTokens((prev) => prev.filter((t) => t.id !== id));
      if (newToken) setNewToken(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("profile.apiTokens.errorRevoke"));
    }
  };

  const handleCopyToken = () => {
    if (!newToken) return;
    void navigator.clipboard.writeText(newToken).then(() => setSuccess(t("profile.apiTokens.newTokenCopied")));
  };

  return (
    <div className="msqdx-glass-panel">
      <header className="msqdx-glass-detail__header">
        <div>
          <p className="msqdx-glass-eyebrow">{t("profile.eyebrow")}</p>
          <h1 style={{ margin: 0 }}>{t("profile.title")}</h1>
          <p className="msqdx-glass-muted" style={{ maxWidth: "640px" }}>
            {t("profile.subtitle")}
          </p>
        </div>
      </header>

      {(error || success) && (
        <div className={error ? "msqdx-glass-error" : "msqdx-glass-success"} style={{ marginBottom: "1rem" }}>
          {error ?? success}
        </div>
      )}

      <Stack spacing={3}>
        <MsqdxCard variant="flat" borderRadius="button" sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={3} alignItems="center">
            <Avatar
              src={avatarUrl || undefined}
              sx={{ width: 72, height: 72, bgcolor: "var(--color-secondary-dx-pink-tint)", color: "text.primary" }}
            >
              {initials}
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <MsqdxTypography variant="h6" weight="semibold" sx={{ mb: 0.5 }}>
                {t("profile.identity.title")}
              </MsqdxTypography>
              <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
                {t("profile.identity.subtitle")}
              </MsqdxTypography>
            </Box>
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Stack spacing={2}>
            <MsqdxFormField
              label={t("profile.identity.fullName")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("profile.identity.fullNamePlaceholder")}
              fullWidth
              sx={FORM_FIELD_ACCENT_SX}
            />
            <MsqdxFormField
              label={t("profile.identity.email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("profile.identity.emailPlaceholder")}
              fullWidth
              sx={FORM_FIELD_ACCENT_SX}
            />
            <MsqdxFormField
              label={t("profile.identity.company")}
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder={t("profile.identity.companyPlaceholder")}
              fullWidth
              sx={FORM_FIELD_ACCENT_SX}
            />
            <MsqdxFormField
              label={t("profile.identity.avatarUrl")}
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder={t("profile.identity.avatarUrlPlaceholder")}
              fullWidth
              sx={FORM_FIELD_ACCENT_SX}
            />
            <MsqdxSelect
              label={t("profile.identity.language")}
              value={locale}
              onChange={(event: any) => setLocale(event.target.value)}
              options={languageOptions}
              size="small"
              sx={FORM_FIELD_ACCENT_SX}
            />
            <MsqdxButton
              variant="contained"
              onClick={handleSaveProfile}
              disabled={savingProfile}
              sx={{ alignSelf: "flex-start" }}
            >
              {savingProfile ? t("profile.identity.saving") : t("profile.identity.save")}
            </MsqdxButton>
          </Stack>
        </MsqdxCard>

        <MsqdxCard variant="flat" borderRadius="button" sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
          <MsqdxTypography variant="h6" weight="semibold" sx={{ mb: 1 }}>
            {t("profile.appearance.title")}
          </MsqdxTypography>
          <MsqdxTypography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
            {t("profile.appearance.subtitle")}
          </MsqdxTypography>
          <Box sx={{ mb: 2 }}>
            <MsqdxTypography variant="subtitle2" weight="medium" sx={{ mb: 0.5 }}>
              {t("settingsTheme.modeTitle")}
            </MsqdxTypography>
            <MsqdxTypography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1 }}>
              {t("settingsTheme.modeSubtitle")}
            </MsqdxTypography>
            <ThemeModeSelector size="small" />
          </Box>
          <MsqdxTypography variant="subtitle2" weight="medium" sx={{ mb: 0.5 }}>
            {t("settingsTheme.sidebarTitle")}
          </MsqdxTypography>
          <MsqdxTypography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1 }}>
            {themeMode === "monochrome"
              ? t("settingsTheme.sidebarDisabledMonochrome")
              : t("settingsTheme.sidebarSubtitle")}
          </MsqdxTypography>
          <Box
            sx={
              themeMode === "monochrome"
                ? { opacity: 0.45, pointerEvents: "none" }
                : undefined
            }
            aria-hidden={themeMode === "monochrome"}
          >
            <BrandColorSelector />
          </Box>
        </MsqdxCard>

        <MsqdxCard variant="flat" borderRadius="button" sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
          <MsqdxTypography variant="h6" weight="semibold" sx={{ mb: 1 }}>
            {t("profile.apiTokens.title")}
          </MsqdxTypography>
          <MsqdxTypography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
            {t("profile.apiTokens.subtitle")}
          </MsqdxTypography>
          {newToken ? (
            <Stack spacing={1} sx={{ mb: 2 }}>
              <MsqdxTypography variant="subtitle2" weight="semibold">
                {t("profile.apiTokens.newTokenTitle")}
              </MsqdxTypography>
              <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                <Box
                  component="code"
                  sx={{
                    flex: 1,
                    minWidth: 200,
                    p: 1,
                    borderRadius: 1,
                    bgcolor: "var(--color-bg-subtle)",
                    fontSize: "0.85rem",
                    wordBreak: "break-all",
                  }}
                >
                  {newToken}
                </Box>
                <MsqdxButton variant="outlined" size="small" onClick={handleCopyToken}>
                  {t("profile.apiTokens.newTokenCopy")}
                </MsqdxButton>
              </Box>
              <MsqdxTypography variant="caption" sx={{ color: "text.secondary" }}>
                {t("profile.apiTokens.newTokenWarning")}
              </MsqdxTypography>
              <MsqdxButton variant="text" size="small" onClick={() => setNewToken(null)}>
                {t("common.close")}
              </MsqdxButton>
            </Stack>
          ) : (
            <Stack direction="row" spacing={1} sx={{ mb: 2 }} alignItems="center" flexWrap="wrap">
              <MsqdxFormField
                label={t("profile.apiTokens.nameLabel")}
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                placeholder={t("profile.apiTokens.namePlaceholder")}
                size="small"
                sx={{ minWidth: 200, ...FORM_FIELD_ACCENT_SX }}
              />
              <MsqdxButton
                variant="contained"
                onClick={handleCreateToken}
                disabled={creatingToken}
                sx={{ mt: 1 }}
              >
                {creatingToken ? t("profile.apiTokens.creating") : t("profile.apiTokens.create")}
              </MsqdxButton>
            </Stack>
          )}
          <MsqdxTypography variant="subtitle2" weight="semibold" sx={{ mb: 1 }}>
            {t("profile.apiTokens.listTitle")}
          </MsqdxTypography>
          {loadingTokens ? (
            <MsqdxTypography variant="body2" color="text.secondary">
              {t("common.loading")}
            </MsqdxTypography>
          ) : apiTokens.length === 0 ? (
            <MsqdxTypography variant="body2" color="text.secondary">
              {t("profile.apiTokens.empty")}
            </MsqdxTypography>
          ) : (
            <Stack spacing={0.5}>
              {apiTokens.map((token) => (
                <Box
                  key={token.id}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    py: 0.5,
                    borderBottom: "1px solid var(--color-border-subtle)",
                  }}
                >
                  <Box>
                    <MsqdxTypography variant="body2">
                      {token.name || token.id.slice(0, 8)}
                    </MsqdxTypography>
                    <MsqdxTypography variant="caption" color="text.secondary">
                      {new Date(token.createdAt).toLocaleString()}
                    </MsqdxTypography>
                  </Box>
                  <MsqdxButton
                    variant="text"
                    size="small"
                    color="error"
                    onClick={() => handleRevokeToken(token.id)}
                  >
                    {t("profile.apiTokens.revoke")}
                  </MsqdxButton>
                </Box>
              ))}
            </Stack>
          )}
        </MsqdxCard>

        <MsqdxCard variant="flat" borderRadius="button" sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
          <MsqdxTypography variant="h6" weight="semibold" sx={{ mb: 1.5 }}>
            {t("profile.security.title")}
          </MsqdxTypography>
          <Stack spacing={2}>
            <MsqdxFormField
              label={t("profile.security.currentPassword")}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              type="password"
              fullWidth
              sx={FORM_FIELD_ACCENT_SX}
            />
            <MsqdxFormField
              label={t("profile.security.newPassword")}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              type="password"
              fullWidth
              sx={FORM_FIELD_ACCENT_SX}
            />
            <MsqdxFormField
              label={t("profile.security.confirmPassword")}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              type="password"
              fullWidth
              sx={FORM_FIELD_ACCENT_SX}
            />
            <MsqdxButton
              variant="outlined"
              onClick={handlePasswordUpdate}
              disabled={savingPassword}
              sx={{ alignSelf: "flex-start" }}
            >
              {savingPassword ? t("profile.security.updating") : t("profile.security.update")}
            </MsqdxButton>
          </Stack>
        </MsqdxCard>

        <MsqdxCard variant="flat" borderRadius="button" sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
          <MsqdxTypography variant="h6" weight="semibold" sx={{ mb: 1 }}>
            {t("profile.session.title")}
          </MsqdxTypography>
          <MsqdxTypography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
            {t("profile.session.subtitle")}
          </MsqdxTypography>
          <MsqdxButton variant="text" onClick={handleLogout}>
            {t("profile.session.logout")}
          </MsqdxButton>
        </MsqdxCard>
      </Stack>
    </div>
  );
}
