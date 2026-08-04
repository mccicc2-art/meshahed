"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getDict, type Locale } from "@/lib/i18n";

function IconHome({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 10.5 12 3l9 7.5"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.5 9.5V20h13V9.5"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconLibrary({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="4"
        width="18"
        height="16"
        rx="2.5"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
      />
      <path
        d="M7 4v16M17 4v16"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconPeople({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} />
      <path
        d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round"
      />
      <path
        d="M16 6.2a3 3 0 0 1 0 5.6M17.5 19c0-2.3-1-4-2.5-5"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconNews({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2.5"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
      />
      <path
        d="M6.5 9h5.5M6.5 12.5h5.5M6.5 16h3"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round"
      />
      <rect
        x="14.5"
        y="9"
        width="3.5"
        height="4"
        rx="1"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
      />
    </svg>
  );
}

export function BottomNav({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const t = getDict(locale);
  // شاشات مركّزة: لا شريط تبويبات يزاحم زر الإجراء
  if (pathname === "/login" || pathname === "/welcome") return null;

  const tabs = [
    { href: "/", label: t.navHome, Icon: IconHome },
    { href: "/library", label: t.navLibrary, Icon: IconLibrary },
    { href: "/news", label: t.navNews, Icon: IconNews },
    { href: "/people", label: t.navPeople, Icon: IconPeople },
  ];

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
        <nav className="pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-[color:var(--surface)]/95 backdrop-blur px-2 py-1.5 shadow-2xl">
          {tabs.map(({ href, label, Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center justify-center gap-0.5 rounded-full px-3 py-2 transition ${
                  active ? "bg-surface-2 text-accent" : "text-muted active:bg-surface-2"
                }`}
              >
                <Icon active={active} />
                <span className={`text-[11px] leading-none ${active ? "font-semibold" : ""}`}>
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* زر البحث الدائري */}
        <Link
          href="/search"
          aria-label={t.navSearch}
          className={`pointer-events-auto shrink-0 grid place-items-center w-[52px] h-[52px] rounded-full border shadow-2xl transition ${
            pathname.startsWith("/search")
              ? "bg-accent text-[color:var(--on-accent)] border-accent"
              : "bg-[color:var(--surface)]/95 backdrop-blur border-border text-foreground active:bg-surface-2"
          }`}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
            <path d="m16 16 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
