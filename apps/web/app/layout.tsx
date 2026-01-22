// Disable static generation to prevent prerendering issues with ThemeRegistry (useContext)
export const dynamic = 'force-dynamic';

import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import "../styles/globals.css";
import "../styles/dashboard-cards.css";
import { ThemeRegistry } from "../components/theme-registry";
import { GlobalErrorHandler } from "../components/global-error-handler";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

export const metadata: Metadata = {
  title: "Audion",
  description: "Chat live with research-driven personas.",
  icons: {
    icon: `${basePath}/favicon.svg`
  }
};

const notoSansJp = Noto_Sans_JP({
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
  variable: "--font-noto-sans-jp",
  display: "swap"
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,200..700,0..1,-50..200"
        />
        <script
          src={`${basePath}/suppress-extension-errors.js`}
          suppressHydrationWarning
        ></script>
      </head>
      <body className={`${notoSansJp.variable} ${notoSansJp.className}`}>
        <GlobalErrorHandler />
        {/* #region agent log */}
        {/* Conditionally render ThemeRegistry to avoid useContext during prerendering */}
        {typeof window !== 'undefined' || process.env.NODE_ENV === 'production' ? (
          <ThemeRegistry>{children}</ThemeRegistry>
        ) : (
          children
        )}
        {/* #endregion */}
      </body>
    </html>
  );
}

