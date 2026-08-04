import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { getT } from "@/lib/locale";
import { getProfile } from "@/lib/data";
import { getDict, isRtl } from "@/lib/i18n";
import { themeById, themeCss } from "@/lib/themes";
import { HeaderShell } from "@/components/HeaderShell";
import { getLocale } from "@/lib/locale";

export const viewport: Viewport = {
  themeColor: "#1b1f2a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export async function generateMetadata(): Promise<Metadata> {
  const t = getDict(await getLocale());
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    applicationName: t.brand,
    appleWebApp: { capable: true, title: t.brand, statusBarStyle: "black-translucent" },
    icons: {
      icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
    },
  };
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
        {/* ألوان الثيم متغيّرات CSS مبنية من قائمة ثابتة في themes.ts — لا مدخلات مستخدم */}
        <style dangerouslySetInnerHTML={{ __html: themeCss(theme) }} />
      </head>
      <body className="min-h-full flex flex-col">
        {/* رابط تخطّي للتنقّل بلوحة المفاتيح — يظهر عند التركيز فقط */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-3 focus:start-3 focus:bg-accent focus:text-[color:var(--on-accent)] focus:px-4 focus:py-2 focus:rounded-lg focus:font-semibold"
        >
          {t.navHome}
        </a>
        <Suspense fallback={null}>
          <HeaderShell>
            <Navbar />
          </HeaderShell>
        </Suspense>
        {/* مساحة سفلية على الجوال حتى لا يغطي شريط التبويبات المحتوى */}
        <main id="main" className="flex-1 w-full max-w-6xl mx-auto px-4 py-6">
          {children}
        </main>
        <footer className="text-center text-xs text-muted py-6 pb-28 md:pb-6">{t.footer}</footer>
        <BottomNav locale={locale} />
      </body>
    </html>
  );
}
