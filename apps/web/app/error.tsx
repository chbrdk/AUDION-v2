"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useI18n } from "../components/i18n/i18n-provider";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ error, reset }: ErrorProps) {
  const { t } = useI18n();

  useEffect(() => {
    console.error("App error boundary:", error);
  }, [error]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "50vh",
        padding: "2rem",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>{t("error.title")}</h1>
      <p style={{ marginBottom: "1.5rem", color: "#666", maxWidth: "28rem", textAlign: "center" }}>
        {t("error.subtitle")}
      </p>
      {error.digest && (
        <p style={{ fontSize: "0.875rem", color: "#999", marginBottom: "1rem" }}>
          {t("error.id", { id: error.digest })}
        </p>
      )}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            padding: "0.75rem 1.5rem",
            fontSize: "1rem",
            backgroundColor: "#0070f3",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          {t("error.cta")}
        </button>
        <Link
          href="/"
          style={{
            padding: "0.75rem 1.5rem",
            fontSize: "1rem",
            backgroundColor: "transparent",
            color: "#0070f3",
            textDecoration: "none",
            borderRadius: "4px",
            border: "1px solid #0070f3",
          }}
        >
          {t("notFound.cta")}
        </Link>
      </div>
    </div>
  );
}
