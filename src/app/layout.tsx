import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { Header } from "@/components/header";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { LANGUAGE_COOKIE_KEY, getLanguageDirection, parseAppLanguage } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: "BookMeNow - מערכת ניהול והזמנת מלונות",
  description: "פלטפורמת הזמנת מלונות וניהול נכסים בעברית, RTL",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const language = parseAppLanguage(cookieStore.get(LANGUAGE_COOKIE_KEY)?.value);
  const direction = getLanguageDirection(language);
  const user = await getCurrentUser();
  return (
    <html lang={language} dir={direction} className="h-full antialiased">
      <body className="min-h-full bg-slate-50 text-slate-900">
        <Header />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-24 md:pb-6">{children}</main>
        <MobileBottomNav language={language} isAuthenticated={Boolean(user)} />
      </body>
    </html>
  );
}
