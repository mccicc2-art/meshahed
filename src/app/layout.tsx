import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { getT } from "@/lib/locale";
import { getProfile } from "@/lib/data";
import { getDict, isRtl } from "@/lib/i18n";
import { themeById, themeCss } from "@/lib/themes";
import { getLocale } from "@/lib/locale";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDict(await getLocale());
  return { title: t.metaTitle, description: t.metaDescription };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { locale, t } = await getT();
  const profile = await getProfile();
  const theme = themeById(profile?.theme);

  return (
    <html
      lang={locale}
      dir={isRtl(locale) ? "rtl" : "ltr"}
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <style dangerouslySetInnerHTML={{ __html: themeCss(theme) }} />
      </head>
      <body className="min-h-full flex flex-col">
        <Navbar />
        {/* مساحة سفلية على الجوال حتى لا يغطي شريط التبويبات المحتوى */}
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-6 pb-28 md:pb-6">
          {children}
        </main>
        <footer className="text-center text-xs text-muted py-6 pb-28 md:pb-6">{t.footer}</footer>
        <BottomNav locale={locale} />
      </body>
    </html>
  );
}
