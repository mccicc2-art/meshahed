"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon, type IconName } from "./Icon";

/**
 * شريط التبويبات السفلي.
 *
 * كبسولة واحدة تحمل التبويبات الأربعة، وإلى جانبها زرّ بحث دائري منفصل —
 * البحث فعلٌ لا وجهة، فلا يقف في صفٍّ مع الأقسام.
 *
 * لكل تبويب لونه الثابت: الأيقونة تُعرف بلونها قبل أن تُقرأ كلمتها،
 * والتبويب النشط وحده يُلوَّن اسمه وتظهر تحته نقطة. اللون هنا لا يتبع
 * `currentColor` كبقية أيقونات التطبيق — الشريط لوحة ألوان مقصودة.
 */

const TABS: { href: string; key: "home" | "library" | "news" | "people"; icon: IconName; color: string }[] = [
  { href: "/", key: "home", icon: "home", color: "var(--accent)" },
  { href: "/library", key: "library", icon: "film", color: "var(--accent-2)" },
  { href: "/news", key: "news", icon: "compass", color: "var(--accent)" },
  { href: "/people", key: "people", icon: "people", color: "var(--accent)" },
];

export function BottomNav({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const t = getDict(locale);
  // شاشات مركّزة: لا شريط تبويبات يزاحم زر الإجراء
  if (pathname === "/login" || pathname === "/welcome") return null;

  const label: Record<string, string> = {
    home: t.navHome,
    library: t.navLibrary,
    news: t.navNews,
    people: t.navPeople,
  };

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="md:hidden fixed bottom-0 inset-x-0 z-40 pointer-events-none">
      <div
        className="flex items-center justify-center gap-3 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3"
        style={{
          background: "linear-gradient(to top, var(--background) 45%, transparent)",
        }}
      >
        {/* كبسولة التبويبات */}
        <nav className="pointer-events-auto flex items-center gap-0.5 rounded-[26px] border border-white/10 bg-[color:var(--surface)]/95 backdrop-blur px-1.5 py-2 shadow-2xl">
          {TABS.map(({ href, key, icon, color }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className="relative flex flex-col items-center justify-center gap-1 rounded-2xl px-3 pt-1 pb-2 transition active:bg-white/5"
              >
                <Icon name={icon} size={23} strokeWidth={1.9} style={{ color }} />
                <span
                  className={`text-[11px] leading-none ${
                    active ? "font-semibold" : "text-muted"
                  }`}
                  style={active ? { color } : undefined}
                >
                  {label[key]}
                </span>
                {/* النقطة تحت الاسم: علامة الموضع في المرجع */}
                <span
                  className={`absolute bottom-0.5 w-1 h-1 rounded-full transition-opacity ${
                    active ? "opacity-100" : "opacity-0"
                  }`}
                  style={{ background: color }}
                  aria-hidden
                />
              </Link>
            );
          })}
        </nav>

        {/* زر البحث الدائري */}
        <Link
          href="/search"
          aria-label={t.navSearch}
          className={`pointer-events-auto shrink-0 grid place-items-center w-[54px] h-[54px] rounded-full border shadow-2xl transition ${
            pathname.startsWith("/search")
              ? "bg-accent text-[color:var(--on-accent)] border-accent"
              : "bg-[color:var(--surface)]/95 backdrop-blur border-white/10 text-foreground active:bg-white/5"
          }`}
        >
          <Icon name="search" size={23} strokeWidth={2} />
        </Link>
      </div>
    </div>
  );
}
