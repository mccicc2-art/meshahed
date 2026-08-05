"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon, type IconName } from "./Icon";

/**
 * شريط التبويبات السفلي.
 *
 * كبسولة واحدة تحمل التبويبات الأربعة. زرّ البحث الدائري حُذف —
 * البحث صار مدخلاً داخل «اكتشف»، فالشريط أنظف والكبسولة في المنتصف.
 *
 * لونان لا أربعة: النشط بنفسجيّ الهوية واسمه أبيض، والخامل رماديّ
 * `#707070`. تلوين كل تبويب بلونه كان يجعل الأربعة متساوية في الصياح،
 * فلا يُعرف موضعك إلا بقراءة الكلمات.
 */

const TABS: {
  href: string;
  key: "home" | "library" | "news" | "people";
  icon: IconName;
}[] = [
  { href: "/", key: "home", icon: "home" },
  { href: "/library", key: "library", icon: "film" },
  { href: "/news", key: "news", icon: "compass" },
  { href: "/people", key: "people", icon: "people" },
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

  /* صفحات التفاصيل والسجلّ تُنسب إلى المكتبة: المستخدم في عمق التطبيق
     يحتاج مرساةً — تبويبٌ لا يضيء يقرأ وكأن الشريط تعطّل */
  const LIBRARY_PREFIXES = ["/library", "/show/", "/movie/", "/stats", "/diary", "/lists", "/ratings"];
  // البحث بابه «اكتشف»، فصفحته تُنسب إليه
  const NEWS_PREFIXES = ["/news", "/search"];
  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : href === "/library"
        ? LIBRARY_PREFIXES.some((p) => pathname.startsWith(p))
        : href === "/news"
          ? NEWS_PREFIXES.some((p) => pathname.startsWith(p))
          : pathname.startsWith(href);

  return (
    <div className="md:hidden fixed bottom-0 inset-x-0 z-40 pointer-events-none">
      <div
        className="flex items-center justify-center gap-3 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3"
        style={{
          background:
            "linear-gradient(to top, var(--background) 45%, transparent)",
        }}
      >
        {/* كبسولة التبويبات */}
        <nav className="pointer-events-auto flex items-center gap-0.5 rounded-[26px] border border-border bg-[color:var(--surface)] px-1.5 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.6)]">
          {TABS.map(({ href, key, icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className="relative flex flex-col items-center justify-center gap-1 rounded-2xl px-3 pt-1 pb-2 transition active:bg-surface-2"
              >
                <Icon
                  name={icon}
                  size={22}
                  strokeWidth={active ? 2.2 : 1.7}
                  style={{
                    color: active ? "var(--accent)" : "var(--disabled)",
                  }}
                />
                <span
                  className={`text-[11px] leading-none ${active ? "font-semibold" : ""}`}
                  style={{
                    color: active ? "var(--foreground)" : "var(--disabled)",
                  }}
                >
                  {label[key]}
                </span>
                {/* النقطة تحت الاسم: علامة الموضع في المرجع */}
                <span
                  className={`absolute bottom-0.5 w-1 h-1 rounded-full transition-opacity ${
                    active ? "opacity-100" : "opacity-0"
                  }`}
                  style={{ background: "var(--accent)" }}
                  aria-hidden
                />
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
