"use client";

// #region agent log
// Disable static generation to prevent prerendering issues
export const dynamic = 'force-dynamic';
// #endregion

import Link from "next/link";
import { createTranslator, normalizeLocale } from "../lib/i18n";

export default function NotFound() {
  const locale =
    typeof document !== "undefined"
      ? normalizeLocale(
          document.cookie
            .split("; ")
            .find((cookie) => cookie.startsWith("audion_locale="))
            ?.split("=")[1] || navigator.language
        )
      : "en";
  const t = createTranslator(locale);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "2rem",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>{t("notFound.title")}</h1>
      <p style={{ marginBottom: "2rem", color: "#666" }}>
        {t("notFound.subtitle")}
      </p>
      <Link
        href="/"
        style={{
          padding: "0.75rem 1.5rem",
          fontSize: "1rem",
          backgroundColor: "#0070f3",
          color: "white",
          textDecoration: "none",
          borderRadius: "4px",
        }}
      >
        {t("notFound.cta")}
      </Link>
    </div>
  );
}


