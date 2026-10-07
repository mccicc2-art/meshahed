"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { claimGesture, releaseGesture } from "@/core/tabDrag";
import { tap } from "@/lib/haptics";
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

  /**
   * 🆕 **السحبُ الأفقيُّ يبدّل التبويب** (D-1312، طلبُ أحمد: «ليش ما نضيف ايماءات» — وشرطُه: «اذا ما ناسب
   * نشيله»، فهو كتلةٌ واحدةٌ هنا تُحذف بلا أثرٍ في غيرها).
   *
   * 🔑 **سحبةٌ تنقل لا لوحاتٌ تنزلق**: كلُّ تبويبٍ علفٌ يُسبر من الخادم، ولا لوحةَ مجاورةً جاهزةً تُجرّ تحت
   * الإصبع كما في `TabPager` — فالسحبةُ تفعل ما تفعله الرقاقةُ حرفاً (الرابطُ نفسُه)، والهيكلُ الرماديُّ
   * يظهر كما يظهر بعد اللمسة.
   * ⚠️ **وثلاثُ مناطقَ لا تسمع** (`data-no-tab-swipe` · `role="dialog"`): المقطعُ (أفقيُّه تقديمٌ وصوت)،
   * والتكبير (سحبُه رأسيٌّ بين المقاطع)، وورقةُ الفلتر. وصفُّ الرقائق نفسُه يُمرَّر أفقيّاً فلا يسمع.
   * ⚠️ **ومالكٌ واحدٌ للّمسة** (`claimGesture`، D-277): السحبُ للتحديث يقرأ الإصبعَ نفسَه.
   * ⚠️ **والتالي ترتيبيٌّ لا جغرافيّ**: المحتوى يتبع الإصبع — يسارٌ بالإنجليزيّة ويمينٌ بالعربيّة.
   */
  const router = useRouter();
  const row = useRef<HTMLDivElement>(null);
  const go = useRef<(dir: 1 | -1) => void>(() => {});
  useEffect(() => {
    go.current = (dir) => {
      const target = TRAILER_TABS[TRAILER_TABS.indexOf(active) + dir];
      if (!target) return;
      tap(8);
      router.push(href(target), { scroll: false });
    };
  });

  useEffect(() => {
    let start: { x: number; y: number; t: number } | null = null;
    let mine = false;
    const end = () => {
      if (mine) releaseGesture("x");
      mine = false;
      start = null;
    };
    const down = (e: TouchEvent) => {
      end();
      if (e.touches.length !== 1) return;
      const el = e.target as Element | null;
      if (el?.closest?.('[data-no-tab-swipe],[role="dialog"]')) return;
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: e.timeStamp };
    };
    const move = (e: TouchEvent) => {
      if (!start || mine) return;
      const dx = e.touches[0].clientX - start.x;
      const dy = e.touches[0].clientY - start.y;
      /* **الرأسيُّ يسبق فيُترك له الإصبع** — الصفحةُ علفٌ يُمرَّر، وهو أصلُها */
      if (Math.abs(dy) > 12 && Math.abs(dy) >= Math.abs(dx)) start = null;
      else if (Math.abs(dx) > 16 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (claimGesture("x")) mine = true;
        else start = null;
      }
    };
    const up = (e: TouchEvent) => {
      const s = start;
      const owned = mine;
      end();
      if (!s || !owned) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - s.x;
      const dy = touch.clientY - s.y;
      /* **سحبةٌ مقصودةٌ لا انحرافُ تمرير**: مسافةٌ وميلٌ وزمن */
      if (Math.abs(dx) < 72 || Math.abs(dx) < Math.abs(dy) * 2 || e.timeStamp - s.t > 700) return;
      const rtl = document.documentElement.dir === "rtl";
      go.current((dx < 0) !== rtl ? 1 : -1);
    };
    document.addEventListener("touchstart", down, { passive: true });
    document.addEventListener("touchmove", move, { passive: true });
    document.addEventListener("touchend", up, { passive: true });
    document.addEventListener("touchcancel", end, { passive: true });
    return () => {
      end();
      document.removeEventListener("touchstart", down);
      document.removeEventListener("touchmove", move);
      document.removeEventListener("touchend", up);
      document.removeEventListener("touchcancel", end);
    };
  }, []);

  /* **والرقاقةُ المختارةُ تدخل المشهد**: السحبُ يبلغ «أنمي» وهي خارج الشاشة — ومختارٌ لا يُرى يُقرأ ضياعاً */
  useEffect(() => {
    row.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [active]);

  return (
    /* **والشريطُ يُمرَّر أفقيّاً على الضيّق** — خمسُ رقائقَ لا تسع
       ٣٩٠px، **ورقاقةٌ تُقصّ تُقرأ عطلاً.** */
    <div ref={row} data-no-tab-swipe className="-mx-4 px-4 flex gap-2 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
