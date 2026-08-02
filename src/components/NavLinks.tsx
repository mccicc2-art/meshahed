"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getDict, type Locale } from "@/lib/i18n";

export function NavLinks({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const t = getDict(locale);

  const links = [
    { href: "/", label: t.navHome },
    { href: "/news", label: t.navNews },
    { href: "/library", label: t.navLibrary },
  ];

  return (
    <nav className="hidden md:flex items-center gap-1 text-sm">
      {links.map((l) => {
        const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`px-2.5 sm:px-3 py-2 rounded-lg transition ${
              active
                ? "text-foreground bg-surface-2 font-semibold"
                : "text-muted hover:text-foreground hover:bg-surface"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
