"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "الرئيسية" },
  { href: "/news", label: "أخبار" },
  { href: "/library", label: "مكتبتي" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="hidden md:flex items-center gap-1 text-sm">
      {LINKS.map((l) => {
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
