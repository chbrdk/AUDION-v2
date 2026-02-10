// Disable static generation to prevent prerendering issues with ThemeRegistry (useContext)
export const dynamic = 'force-dynamic';

import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import { cookies, headers } from "next/headers";
import "../styles/globals.css";
import "../styles/dashboard-cards.css";
import { I18nProvider } from "../components/i18n/i18n-provider";
import { resolveLocale } from "../lib/i18n";

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

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const headersList = await headers();
  const locale = resolveLocale(cookieStore.get("audion_locale")?.value, headersList.get("accept-language"));
  return (
    <html lang={locale} suppressHydrationWarning>
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
        <I18nProvider initialLocale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
