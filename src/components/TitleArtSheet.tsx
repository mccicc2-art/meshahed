"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Sheet, SheetHeader } from "./ui/Sheet";
import { Icon } from "./Icon";
import { segmentedItem, segmentedTrackFull, sheetScroll } from "./ui/controls";
import { getDict, type Locale } from "@/core/i18n";
import { posterUrl, backdropUrl, type MediaType } from "@/core/media";
import { tap } from "@/lib/haptics";
import { toast, flashError } from "@/lib/toast";
import { coalescedRefresh } from "@/core/refresh";
import { titleArtOptions, setTitleArt, canUseArt } from "@/lib/actions";
import Link from "next/link";

/**
 * منتقي غلاف العمل (D-131) — «هذا العمل بالوجه الذي أريده».
 *
 * **الترتيب هو الميزة لا العدد** (ق٧): الخادم يرتّب صور TMDB بلغة
 * المستخدم ثم الإنجليزية ثم بلا نصّ ثم بعدد الأصوات، فأوّلُ ما تراه
 * العين صالحٌ لك. والسقف معلَن (٢٤ ملصقاً و١٢ خلفية) لأن أربعين صورةً
 * في ورقةٍ واحدة تقتل شبكة الجوال.
 *
 * **الأثر لا يتعدّى سطوحك** (ق٨): مكتبتُك وصفحةُ العمل عندك وبروفايلك.
 * لا اكتشف، ولا فيد من يتابعك — التعرّف على العمل أغلى ما تملكه البطاقة،
 * وتشويهُه عند الآخرين ليس زينةً بل عطل.
 *
 * والصور تُجلب **عند الفتح** لا مع الصفحة: من لا يفتح الورقة لا يدفع
 * نداءً (نمط `SendShareSheet` نفسه).
 */
export function TitleArtSheet({
  tmdbId,
  mediaType,
  locale,
  current,
  onClose,
}: {
  tmdbId: number;
  mediaType: MediaType;
  locale: Locale;
  /** اختياري الحالي إن وُجد — كي تُعلَّم الصورة المختارة */
  current: { poster_path: string | null; backdrop_path: string | null } | null;
  onClose: () => void;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [tab, setTab] = useState<"poster" | "backdrop">("poster");
  const [opts, setOpts] = useState<{ posters: string[]; backdrops: string[] } | null>(null);
  /* 🆕 **حالةُ القفل تُقرأ من الخادم عند الفتح** (D-786): `null` = لم
     يُعرف بعد. **ولا تُشتقّ من معاملٍ يمرّ عبر صفحة العمل**: تمريرُها
     يكلّف استعلامَ خطّةٍ على كلِّ فتحةِ صفحةِ عملٍ لأجل ورقةٍ قد لا
     تُفتح — **والسرعةُ أولويّةٌ مكتوبة، لا تُدفع لأجل قفل.** */
  const [locked, setLocked] = useState<boolean | null>(null);
  const [poster, setPoster] = useState(current?.poster_path ?? null);
  const [backdrop, setBackdrop] = useState(current?.backdrop_path ?? null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let dead = false;
    Promise.all([titleArtOptions(tmdbId, mediaType), canUseArt()])
      .then(([r, allowed]) => {
        if (dead) return;
        setOpts(r);
        setLocked(!allowed);
      })
      .catch(() => {
        if (dead) return;
        setOpts({ posters: [], backdrops: [] });
        setLocked(false);
      });
    return () => {
      dead = true;
    };
  }, [tmdbId, mediaType]);

  function save(nextPoster: string | null, nextBackdrop: string | null) {
    start(async () => {
      try {
        await setTitleArt({
          tmdbId,
          mediaType,
          posterPath: nextPoster,
          backdropPath: nextBackdrop,
        });
        toast(nextPoster || nextBackdrop ? t.artSaved : t.artReset, { tone: "success" });
        coalescedRefresh(router);
      } catch (e) {
        flashError((e as Error).message);
      }
    });
  }

  const rows = tab === "poster" ? (opts?.posters ?? []) : (opts?.backdrops ?? []);
  const chosen = tab === "poster" ? poster : backdrop;

  function choose(path: string) {
    tap(8);
    // الضغط على المختار يلغيه — لا زرَّ ثالثاً لفعلٍ عكسيّ واضح
    const next = chosen === path ? null : path;
    if (tab === "poster") {
      setPoster(next);
      save(next, backdrop);
    } else {
      setBackdrop(next);
      save(poster, next);
    }
  }

  return (
    <Sheet open variant="top" onClose={onClose} closeLabel={t.closeLabel} labelledBy="art-title">
      <SheetHeader id="art-title" title={t.artTitle} closeLabel={t.closeLabel} onClose={onClose}>
        <p className="text-xs text-muted mt-0.5">{t.artHint}</p>
      </SheetHeader>

      <div className="px-5 pt-3">
        <div role="tablist" aria-label={t.artTitle} className={segmentedTrackFull}>
          {(["poster", "backdrop"] as const).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => {
                tap(6);
                setTab(k);
              }}
              className={segmentedItem(tab === k, "flex-1 basis-0 min-w-0")}
            >
              {k === "poster" ? t.artPosters : t.artBackdrops}
            </button>
          ))}
        </div>
      </div>

      <div className={`${sheetScroll} px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]`}>
        {/* 🆕 **ومن يُمنع يعرف الثمنَ في اللحظة نفسِها** (D-786، نمطُ
            `PlusGateHost` حرفاً): **شبكةٌ فارغةٌ بلا سببٍ مكتوب تُقرأ
            عطلاً لا قفلاً** — ومن يظنّه عطلاً لا يشتري، بل يبلّغ عنه. */}
        {locked === true ? (
          <div className="py-8 flex flex-col items-center gap-3 text-center">
            <Icon name="sparkle-star" size={26} className="text-accent" />
            <p className="text-15 font-bold leading-tight">{t.plusGateTitle}</p>
            <p className="text-12 text-muted leading-relaxed max-w-xs">{t.plusGateHint}</p>
            <div className="rounded-2xl border border-border bg-surface px-4 py-3">
              <p className="text-15 font-bold leading-none">{t.plusPrice}</p>
              <p className="mt-1 text-12 text-muted leading-none">{t.plusPriceRenew}</p>
              <p className="mt-1.5 text-12 text-muted leading-none">{t.plusSoon}</p>
            </div>
            <Link href="/plus" className="text-12 font-bold text-accent hover:underline">
              {t.plusLearnMore}
            </Link>
          </div>
        ) : opts === null ? (
          <p className="text-sm text-muted text-center py-10">{t.peopleSearching}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted text-center py-10">{t.artEmpty}</p>
        ) : (
          <>
            {/* «الأصل» أوّلاً: الرجوع خيارٌ ظاهر لا فعلٌ مخفيّ */}
            {chosen && (
              <button
                type="button"
                disabled={pending}
                onClick={() => choose(chosen)}
                className="mb-4 inline-flex items-center gap-2 rounded-full border border-border px-3.5 py-2 text-12 font-semibold text-muted hover:text-foreground transition disabled:opacity-50"
              >
                <Icon name="repeat" size={14} />
                {t.artUseDefault}
              </button>
            )}
            <ul
              className={
                tab === "poster"
                  ? "grid grid-cols-3 sm:grid-cols-4 gap-3"
                  : "grid grid-cols-2 gap-3"
              }
            >
              {rows.map((path) => {
                const on = chosen === path;
                const src =
                  tab === "poster" ? posterUrl(path, "w185") : backdropUrl(path, "w780");
                return (
                  <li key={path}>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => choose(path)}
                      aria-pressed={on}
                      aria-label={on ? t.artChosen : t.artChoose}
                      className={`relative block w-full overflow-hidden rounded-xl border-2 transition disabled:opacity-50 ${
                        on ? "border-accent" : "border-transparent hover:border-border"
                      }`}
                    >
                      {src && (
                        <Image
                          src={src}
                          alt=""
                          width={tab === "poster" ? 185 : 390}
                          height={tab === "poster" ? 278 : 219}
                          sizes={tab === "poster" ? "120px" : "240px"}
                          loading="lazy"
                          className={`w-full h-auto object-cover bg-surface-2 ${
                            tab === "poster" ? "aspect-[2/3]" : "aspect-video"
                          }`}
                        />
                      )}
                      {on && (
                        <span className="absolute top-1.5 end-1.5 grid place-items-center w-6 h-6 rounded-full bg-accent text-[color:var(--on-accent)]">
                          <Icon name="check" size={13} strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </Sheet>
  );
}
