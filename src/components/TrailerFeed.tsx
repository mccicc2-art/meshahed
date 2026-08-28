"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { TrailerPlayer } from "./TrailerPlayer";
import { Icon } from "./Icon";
import { setTrailerSound, dismissTitle, undoDismissTitle, follow } from "@/lib/actions";
import { toast, flashError } from "@/lib/toast";
import { getDict, type Locale } from "@/lib/i18n";
import type { TrailerItem } from "@/lib/trailers";

/**
 * 🆕 **علفُ الترايلرات الرأسيّ** (D-726) — صفحةُ `/trailers`.
 *
 * ⚠️ **والالتقاطُ يتكفّل بالتمرير لا جافاسكربت**: `snap-y snap-mandatory`
 * **والمشغّلُ نفسُه يشتغل عند ٦٠٪ ويقف حين يخرج** — **فلا مستمعَ
 * `scroll` ولا حسابَ مواضع**: **قاعدةُ الرؤية واحدةٌ في الرايل وفي
 * الصفحة** (القاعدة ٣)، **ومنطقٌ ثانٍ للتشغيل هنا يفترق عن أخيه أوّلَ
 * إصلاح.**
 *
 * 🔑 **و«ليس لي» بابٌ مبنيٌّ منذ D-322**: `dismissed_titles` وفعلُها
 * قائمان ويُصفّيان `getSuggestions` — **فلا هجرةَ ولا جدولَ ولا فعلَ
 * جديد**، **والأثرُ يظهر في الترشيحات القادمة كما اشترط.**
 */
export function TrailerFeed({
  items,
  locale,
  soundOn,
  startAt,
  emptyLabel,
}: {
  items: TrailerItem[];
  locale: Locale;
  soundOn: boolean;
  startAt?: string;
  /** 🆕 **ونصُّ الفراغ يأتي من فوق** (D-734): **فراغُ «لك» يُصلحه أن
      تتابع، وفراغُ تبويبِ كتالوجٍ عطلُ مصدرٍ لا حيلةَ للقارئ فيه** —
      **ونصٌّ واحدٌ للحالتين يُرشد إحداهما ويكذب على الأخرى.** */
  emptyLabel?: string;
}) {
  const t = getDict(locale);
  const [muted, setMuted] = useState(!soundOn);
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const [added, setAdded] = useState<ReadonlySet<string>>(new Set());
  const box = useRef<HTMLDivElement>(null);

  const keyOf = (i: TrailerItem) => `${i.mediaType}-${i.tmdbId}`;

  /* **والفتحُ من العمل المطلوب لا من رأس القائمة** (شرطُه: «الضغط على
     فيديو يفتح الـFeed من نفس العمل») — **قفزةٌ بلا حركةٍ قبل أوّل
     رسم**، فلا يرى القارئُ عملاً غيرَ الذي ضغطه ثمّ ينزلق عنه. */
  useEffect(() => {
    if (!startAt) return;
    const el = box.current?.querySelector<HTMLElement>(`[data-key="${CSS.escape(startAt)}"]`);
    el?.scrollIntoView({ block: "start", behavior: "auto" });
  }, [startAt]);

  function changeMuted(next: boolean) {
    setMuted(next);
    setTrailerSound(!next).catch(() => {});
  }

  function notForMe(i: TrailerItem) {
    const k = keyOf(i);
    setGone((p) => new Set(p).add(k));
    dismissTitle({ tmdbId: i.tmdbId, mediaType: i.mediaType }).catch((e) =>
      flashError((e as Error).message),
    );
    toast(t.dismissedToast, {
      tone: "info",
      action: {
        label: t.undoWatched,
        run: () => {
          setGone((p) => {
            const n = new Set(p);
            n.delete(k);
            return n;
          });
          undoDismissTitle({ tmdbId: i.tmdbId, mediaType: i.mediaType }).catch(() => {});
        },
      },
    });
  }

  function addToList(i: TrailerItem) {
    const k = keyOf(i);
    setAdded((p) => new Set(p).add(k));
    follow({ tmdbId: i.tmdbId, mediaType: i.mediaType, title: i.title, posterPath: i.posterPath }).catch((e) => {
      setAdded((p) => {
        const n = new Set(p);
        n.delete(k);
        return n;
      });
      flashError((e as Error).message);
    });
  }

  const shown = items.filter((i) => !gone.has(keyOf(i)));

  if (!shown.length) {
    return <p className="px-4 py-16 text-center text-sm text-muted">{emptyLabel ?? t.trailersEmpty}</p>;
  }

  return (
    /* ⚠️ **ولا `snap-*` هنا** (D-726): **الالتقاطُ يحتاج حاويةً تُمرَّر
       بنفسها** (`h-screen overflow-y-scroll`) **والصفحةُ تُمرَّر بجسدها**
       — **فالصنفُ كان سيُكتب ولا يفعل شيئاً.** 🔑 **والذي ينفّذ شرطَه
       («التمرير للأسفل يشغّل التالي ويوقف السابق») هو المراقبُ في
       المشغّل نفسِه** — **وصنفٌ خاملٌ يُقرأ ميزةً قائمةً فيُبنى فوقه.** */
    <div ref={box}>
      {shown.map((i) => {
        const k = keyOf(i);
        const isAdded = added.has(k);
        return (
          <section key={k} data-key={k} className="pb-4">
            <div className="rounded-2xl border border-border bg-surface overflow-hidden">
              <TrailerPlayer
                videoKey={i.videoKey}
                videoKeys={i.videoKeys}
                backdrop={i.backdrop}
                title={i.title}
                muted={muted}
                onMutedChange={changeMuted}
                playLabel={t.trailerPlay}
                muteLabel={t.trailerMute}
                unmuteLabel={t.trailerUnmute}
                seekLabel={t.trailerSeek}
                className="aspect-video w-full"
              />

              <div className="px-4 pt-3.5 pb-2">
                <h2 className="text-22 font-bold truncate">{i.title}</h2>
                {/* 🆕 **والنسبةُ بجوار التصنيف** (D-729، حكمُه) — سطرٌ
                    واحدٌ يجمع السنةَ والنوعَ والنسبة، **ولا سطرَ ثالثٌ
                    لكلمةٍ واحدة.** */}
                <p className="mt-1 text-14 text-muted truncate">
                  {[i.year, i.genre, i.country].filter(Boolean).join(" · ")}
                </p>
                {/* 🆕 **والنبذةُ ثلاثةُ أسطرٍ في الصفحة الكاملة وحدَها**
                    (D-729، حكمُه: «إذا فتحت قائمة الترايلر أبغاه يعرض
                    النبذة»): **هنا البطاقةُ وحدَها في الشاشة فللنصِّ
                    مكان** — **وفي صفِّ اكتشف تُطيل البطاقةَ بلا أن
                    تُقرأ** (D-510). ⚠️ **و`line-clamp-3` لا قصٌّ
                    بالحروف**: القصُّ الحسابيُّ يقطع الكلمةَ ويكذب على
                    مقاسات الخطوط. */}
                {i.overview && (
                  <p className="mt-2.5 text-14 leading-relaxed line-clamp-3" dir="auto">
                    {i.overview}
                  </p>
                )}
                {/* **وسببُ الترشيح آخرَ الكتلة** — هو أضعفُها رتبةً */}
                {i.note && <p className="mt-2.5 text-14 text-muted truncate">{i.note}</p>}
              </div>

              {/* **ثلاثةُ أفعالٍ بوصفةٍ واحدة** — رمزٌ فوق كلمةٍ بعرضٍ
                  متساوٍ، **وفاصلٌ فوقها كفاصل بطاقة الملفّ** (D-687). */}
              <div className="mt-1 grid grid-cols-3 border-t border-[color:var(--divider)]">
                <Link
                  href={`/${i.mediaType === "tv" ? "show" : "movie"}/${i.tmdbId}`}
                  prefetch={false}
                  className="flex flex-col items-center gap-1.5 py-3 text-12 text-muted active:opacity-70 transition"
                >
                  <Icon name="info" size={21} />
                  {t.trailerDetails}
                </Link>
                <button
                  type="button"
                  onClick={() => addToList(i)}
                  disabled={isAdded}
                  className={`flex flex-col items-center gap-1.5 py-3 text-12 active:opacity-70 transition ${
                    isAdded ? "text-accent" : "text-muted"
                  }`}
                >
                  <Icon name={isAdded ? "check" : "plus"} size={21} />
                  {t.trailerMyList}
                </button>
                <button
                  type="button"
                  onClick={() => notForMe(i)}
                  className="flex flex-col items-center gap-1.5 py-3 text-12 text-muted active:opacity-70 transition"
                >
                  <Icon name="eye-off" size={21} />
                  {t.trailerNotForMe}
                </button>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
