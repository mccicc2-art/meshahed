import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "مشاهد — تابع مسلسلاتك وأفلامك",
  description: "تطبيق لمتابعة المسلسلات والأفلام وتتبّع الحلقات المشاهَدة.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <Navbar />
        {/* مساحة سفلية على الجوال حتى لا يغطي شريط التبويبات المحتوى */}
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-6 pb-28 md:pb-6">
          {children}
        </main>
        <footer className="text-center text-xs text-muted py-6 pb-28 md:pb-6">
          مشاهد · البيانات من TMDB
        </footer>
        <BottomNav />
      </body>
    </html>
  );
}
