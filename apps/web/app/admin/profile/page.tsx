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
import { BRAND_COLOR } from "../../../lib/branding";

const languageOptions = [
  { value: "de", label: "Deutsch" },
  { value: "en", label: "English" },
];

export default function ProfilePage() {
  const router = useRouter();
  const { user, updateProfile, changePassword, logout } = useAuth();

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
      setSuccess("Profile updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordUpdate = async () => {
    setError(null);
    setSuccess(null);
    if (!currentPassword || !newPassword) {
      setError("Please enter your current and new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password confirmation does not match.");
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword({ current_password: currentPassword, new_password: newPassword });
      setSuccess("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password");
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
          <p className="msqdx-glass-eyebrow">Account</p>
          <h1 style={{ margin: 0 }}>Profile</h1>
          <p className="msqdx-glass-muted" style={{ maxWidth: "640px" }}>
            Manage your identity, preferences, and security. Changes apply immediately to all projects.
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
                Identity
              </MsqdxTypography>
              <MsqdxTypography variant="body2" sx={{ color: "text.secondary" }}>
                Update how your profile appears across Audion.
              </MsqdxTypography>
            </Box>
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Stack spacing={2}>
            <MsqdxFormField
              label="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              fullWidth
              borderColor={BRAND_COLOR}
            />
            <MsqdxFormField
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              fullWidth
              borderColor={BRAND_COLOR}
            />
            <MsqdxFormField
              label="Company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Company name"
              fullWidth
              borderColor={BRAND_COLOR}
            />
            <MsqdxFormField
              label="Avatar URL"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://..."
              fullWidth
              borderColor={BRAND_COLOR}
            />
            <MsqdxSelect
              label="Language"
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
              {savingProfile ? "Saving..." : "Save Profile"}
            </MsqdxButton>
          </Stack>
        </MsqdxCard>

        <MsqdxCard variant="flat" borderRadius="button" sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
          <MsqdxTypography variant="h6" weight="semibold" sx={{ mb: 1.5 }}>
            Security
          </MsqdxTypography>
          <Stack spacing={2}>
            <MsqdxFormField
              label="Current Password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              type="password"
              fullWidth
              borderColor={BRAND_COLOR}
            />
            <MsqdxFormField
              label="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              type="password"
              fullWidth
              borderColor={BRAND_COLOR}
            />
            <MsqdxFormField
              label="Confirm New Password"
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
              {savingPassword ? "Updating..." : "Update Password"}
            </MsqdxButton>
          </Stack>
        </MsqdxCard>

        <MsqdxCard variant="flat" borderRadius="button" sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
          <MsqdxTypography variant="h6" weight="semibold" sx={{ mb: 1 }}>
            Session
          </MsqdxTypography>
          <MsqdxTypography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
            Log out from this device. You will need to sign in again to access your projects.
          </MsqdxTypography>
          <MsqdxButton variant="text" onClick={handleLogout}>
            Log out
          </MsqdxButton>
        </MsqdxCard>
      </Stack>
    </div>
  );
}
