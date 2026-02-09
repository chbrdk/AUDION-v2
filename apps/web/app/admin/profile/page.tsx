"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
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
import { BRAND_COLOR } from "../../../lib/branding";

export default function ProfilePage() {
  const router = useRouter();
  const { user, updateProfile, changePassword, logout } = useAuth();
  const { t, setLocale: setUiLocale } = useI18n();

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

  useEffect(() => {
    if (!user) return;
    setName(user.name ?? "");
    setEmail(user.email ?? "");
    setCompany(user.company ?? "");
    setAvatarUrl(user.avatar_url ?? "");
    setLocale(user.locale ?? "en");
  }, [user]);

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
              borderColor={BRAND_COLOR}
            />
            <MsqdxFormField
              label={t("profile.identity.email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("profile.identity.emailPlaceholder")}
              fullWidth
              borderColor={BRAND_COLOR}
            />
            <MsqdxFormField
              label={t("profile.identity.company")}
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder={t("profile.identity.companyPlaceholder")}
              fullWidth
              borderColor={BRAND_COLOR}
            />
            <MsqdxFormField
              label={t("profile.identity.avatarUrl")}
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder={t("profile.identity.avatarUrlPlaceholder")}
              fullWidth
              borderColor={BRAND_COLOR}
            />
            <MsqdxSelect
              label={t("profile.identity.language")}
              value={locale}
              onChange={(event: any) => setLocale(event.target.value)}
              options={languageOptions}
              size="small"
              borderColor={BRAND_COLOR}
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
              borderColor={BRAND_COLOR}
            />
            <MsqdxFormField
              label={t("profile.security.newPassword")}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              type="password"
              fullWidth
              borderColor={BRAND_COLOR}
            />
            <MsqdxFormField
              label={t("profile.security.confirmPassword")}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              type="password"
              fullWidth
              borderColor={BRAND_COLOR}
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
