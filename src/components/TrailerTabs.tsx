"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { getDict, type Locale } from "@/core/i18n";
import { TRAILER_TABS, type TrailerTab } from "@/core/trailerTabs";

/**
 * 🆕 **شريطُ رقائق صفحة الترايلرات** (D-734، تصميمُه).
 *
 * 🔑 **ورقائقُ روابطَ لا أزرارَ حالة**: **كلُّ تبويبٍ عنوانٌ يُشارَك
 * ويُحفظ ويعود إليه زرُّ الرجوع** — **وحالةٌ في العميل تجعل التبويبَ
 * شيئاً لا يُرجَع إليه** (سابقةُ `?tab=` في اكتشف، `browse.ts`).
 * ⚠️ **والوجهةُ تُبنى من المسار الحاليّ لا تُكتب حرفيّاً** — **ورابطٌ
 * مكتوبٌ بيدٍ يفترق يومَ ينتقل المسار.**
 * ⚠️ **و`at=` يسقط عند تبديل التبويب**: **موضعُ عملٍ في تبويبٍ لا يعني
 * شيئاً في غيره** — **وحملُه معه يفتح تبويباً جديداً على عملٍ ليس فيه.**
 */
export function TrailerTabs({ active, locale }: { active: TrailerTab; locale: Locale }) {
  const t = getDict(locale);
  const pathname = usePathname();
  const sp = useSearchParams();

  const label: Record<TrailerTab, string> = {
    "for-you": t.trailerTabForYou,
    trending: t.trailerTabTrending,
    movies: t.trailerTabMovies,
    shows: t.trailerTabShows,
    anime: t.trailerTabAnime,
  };

  function href(tab: TrailerTab) {
    const next = new URLSearchParams(sp.toString());
    next.delete("at");
    if (tab === "for-you") next.delete("tab");
    else {
      next.set("tab", tab);
      next.delete("scope");
    }
    const q = next.toString();
    return q ? `${pathname}?${q}` : pathname;
  }

  return (
    /* **والشريطُ يُمرَّر أفقيّاً على الضيّق** — خمسُ رقائقَ لا تسع
       ٣٩٠px، **ورقاقةٌ تُقصّ تُقرأ عطلاً.** */
    <div className="-mx-4 px-4 flex gap-2 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {TRAILER_TABS.map((tab) => {
        const on = tab === active;
        return (
          <Link
            key={tab}
            href={href(tab)}
            prefetch={false}
            scroll={false}
            aria-current={on ? "page" : undefined}
            /* **والمختارُ يلبس لونَ الهويّة والباقي حدٌّ هادئ** — رتبةٌ
               تُقال باللون لا بالمقاس (سابقةُ رقائق اكتشف). */
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-14 font-semibold transition ${
              on
                ? "bg-accent text-[color:var(--on-accent)]"
                : "border border-border text-muted active:opacity-70"
            }`}
          >
            {label[tab]}
          </Link>
        );
      })}
    </div>
  );
}
