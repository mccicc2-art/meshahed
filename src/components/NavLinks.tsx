"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getDict, type Locale } from "@/core/i18n";
import { usePrefetchOnIntent } from "@/lib/prefetchIntent";

export function NavLinks({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const t = getDict(locale);
  // تسخينُ الوجهة عند حومان المؤشّر أو تركيز الكيبورد — نفس صمّامات الشريط السفليّ
  const prewarm = usePrefetchOnIntent();
  /* والمكتبةُ — الوجهةُ المرجَّحة — تُسخَّن كاملةً من الرؤية
     (`prefetch={true}`)؛ انظر الحجّة في `BottomNav` */
  const conn = (
    typeof navigator === "undefined"
      ? undefined
      : (navigator as Navigator & {
          connection?: { saveData?: boolean; effectiveType?: string };
        }).connection
  );
  const fullOk = !conn?.saveData && !(conn?.effectiveType ?? "").includes("2g");

  const links = [
    { href: "/", label: t.navHome },
    { href: "/library", label: t.navLibrary },
    { href: "/news", label: t.navNews },
    { href: "/people", label: t.navPeople },
  ];

  return (
    <nav className="hidden md:flex items-center gap-1 text-sm">
      {links.map((l) => {
        const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            /* `false` صريحةٌ لغير المكتبة — انظر الحجّة الكاملة في
               `BottomNav`: `undefined` = `auto` = تسخينٌ من الرؤية. */
            prefetch={l.href === "/library" && fullOk}
            /* حارسُ نوع المؤشّر — انظر الحجّة الكاملة في `BottomNav`:
               **هذا الشريطُ `md:` فما فوق، ولوحٌ لمسيٌّ في العرض يراه**،
               **فيدفع الطلبَ الزائد نفسَه لو تُرك عارياً.** */
            onPointerEnter={(e) => {
              if (e.pointerType !== "touch") prewarm(l.href);
            }}
            onFocus={() => prewarm(l.href)}
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
