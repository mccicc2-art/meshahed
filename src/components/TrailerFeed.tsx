"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { TrailerPlayback } from "./trailers/TrailerPlaybackController";
import { TrailerCardMedia } from "./trailers/TrailerCardMedia";
import { Icon } from "./Icon";
import { dismissTitle, moreTrailerClips, undoDismissTitle } from "@/lib/actions";
import { toast, flashError } from "@/lib/toast";
import {
  trailerClipKeyOf,
  trailerKeyOf,
  trailerTitleHref,
  useTrailerFollow,
  useTrailerSlots,
} from "@/lib/trailerCard";
import { getDict, type Locale } from "@/core/i18n";
import { TRAILER_FEED_LIMIT, TRAILER_PER_TITLE } from "@/core/trailerTabs";
import type { TrailerItem } from "@/lib/trailers";

/**
 * 🆕 **علفُ الترايلرات الرأسيّ** (D-726) — صفحةُ `/trailers`.
 *
 * ⚠️ **والتمريرُ يتكفّل بالتشغيل لا جافاسكربت**: متحكّمُ D-759 يمنح
 * الدورَ عند ٦٠٪ ويسحبه تحت ١٥٪ — **فلا مستمعَ `scroll` ولا حسابَ
 * مواضع**: **قاعدةُ الرؤية واحدةٌ في الرايل وفي الصفحة** (القاعدة ٣).
 *
 * 🔑 **و«ليس لي» بابٌ مبنيٌّ منذ D-322**: `dismissed_titles` وفعلُها
 * قائمان ويُصفّيان `getSuggestions` — **فلا هجرةَ ولا جدولَ ولا فعلَ
 * جديد**، **والأثرُ يظهر في الترشيحات القادمة كما اشترط.**
 * 🔴 🆕 **وفعلُ القارئ ليس كعطلِنا** (D-756): **«ليس لي» حذفٌ طلبَه
 * صاحبُ الإصبع فيُطوى ويُتراجَع عنه** — **ومقطعٌ يرفضه يوتيوب عطلٌ لم
 * يطلبه أحد، فيُستبدَل في خانته من فائض المسبار.**
 * 🔑 **والقاعدة: ما أزاحه القارئُ بيده يُقرأ استجابة، وما أزاحه الغيبُ
 * يُقرأ اهتزازاً** — **ووصفةٌ واحدةٌ للحالتين تُخطئ في إحداهما.**
 */

/**
 * **ما يُعرض من العلف** — وما زاد عليه في `items` بدائلُ خاناته (D-756).
 * ⚖️ 🆕 **واثنتا عشرةَ صارت أربعين** (D-772، بلاغُ أحمد: «الفيديوهات
 * قليلة… ما بغا توقف»): **البطاقةُ صارت مقطعاً لا عملاً** — **والحمولةُ
 * التي كانت تحمل ٥٥ مفتاحاً لتعرض اثني عشر صارت تعرض أربعين منها**،
 * **بصفر نداءٍ إضافيٍّ لكلِّ مقطعٍ زائد** (الزيادةُ الوحيدةُ ثلاثةُ
 * أعمالٍ في المسبار: ٢١ ← ٢٤).
 */
const FEED_SLOTS = 40;

export function TrailerFeed({
  items: served,
  locale,
  soundOn,
  emptyLabel,
  tab,
  scope,
}: {
  items: TrailerItem[];
  locale: Locale;
  soundOn: boolean;
  /** 🆕 D-772: هويّةُ العلف — بها يطلب دفعتَه التالية من الخادم */
  tab?: string;
  scope?: string;
  /** 🆕 **ونصُّ الفراغ يأتي من فوق** (D-734): **فراغُ «لك» يُصلحه أن
      تتابع، وفراغُ تبويبِ كتالوجٍ عطلُ مصدرٍ لا حيلةَ للقارئ فيه** —
      **ونصٌّ واحدٌ للحالتين يُرشد إحداهما ويكذب على الأخرى.** */
  emptyLabel?: string;
}) {
  const t = getDict(locale);
  /* 🔴 D-1296 — **العلفُ يثبت على ما فُتح به** (بلاغُ أحمد بتسجيل على التكبير: «ما ابغاه يروح بعد ما اضيفه
     اللست»): `follow` تُبطل مسارات، وإبطالٌ من فعلِ خادمٍ يعيد رسمَ الصفحة القائمة — و«لك» تُسقط المتابَعَ
     (`getSuggestions`)، **فيُحذف العملُ الذي أضافه للتوّ من تحته**: بطاقتُه تحمل المشغّل، فيسقط التكبيرُ
     وتتبدّل القائمةُ كلُّها بعد ثانيتين من ضغطةٍ لم تطلب شيئاً من ذلك. **وهو D-756 بعينه**: ما أزاحه الغيبُ
     يُقرأ اهتزازاً. فالحمولةُ الأولى هي العلفُ ما عاش المكوّن، والمُضافُ يبقى بعلامته ويخرج في الزيارة
     التالية. **وتبديلُ التبويب لا يتأثّر**: مفتاحُ `Suspense` في الصفحة يبني مكوّناً جديداً بحمولته. */
  const [items] = useState(served);
  const { added, addToList } = useTrailerFollow();
  /**
   * 🆕 **الدفعاتُ التاليةُ تُلحق بالأولى** (D-772) — **والخانةُ تُحسب
   * على المجموع**: `useTrailerSlots` يقصّ عند `count`، **فسقفٌ ثابتٌ
   * كان سيبتلع كلَّ دفعةٍ تصل.**
   */
  const [extra, setExtra] = useState<TrailerItem[]>([]);
  const all = extra.length ? [...items, ...extra] : items;
  const { slots, retire } = useTrailerSlots(all, FEED_SLOTS + extra.length);
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());

  function notForMe(i: TrailerItem) {
    const k = trailerKeyOf(i);
    setGone((previous) => new Set(previous).add(k));
    dismissTitle({ tmdbId: i.tmdbId, mediaType: i.mediaType }).catch((e) =>
      flashError((e as Error).message),
    );
    toast(t.dismissedToast, {
      tone: "info",
      action: {
        label: t.undoWatched,
        /* **والتراجعُ يُعيد البطاقةَ إلى مكانها** — **ولو استُبدلت
           ببديلٍ لَما كان للتراجع ما يُعيده** (وهو سببُ بقاء «ليس لي»
           على الطيّ لا على الاستبدال). */
        run: () => {
          setGone((previous) => {
            const next = new Set(previous);
            next.delete(k);
            return next;
          });
          undoDismissTitle({ tmdbId: i.tmdbId, mediaType: i.mediaType }).catch(() => {});
        },
      },
    });
  }

  /**
   * 🆕 **ويطلب دفعتَه التاليةَ عند بلوغ آخره** (D-772، حكمُه: «ما بغا
   * توقف») — **مراقبُ تقاطعٍ على حارسٍ في الذيل لا مستمعُ تمرير**:
   * **قاعدةُ الرؤية واحدةٌ في هذا السطح** (القاعدة ٣، ومتحكّمُ D-759
   * يشغّل بها أصلاً) — **ومستمعُ `scroll` ثانٍ كان سيحسب المواضعَ في
   * كلِّ إطار.**
   * ⚠️ **ونداءٌ واحدٌ في كلِّ لحظة** (`busy`)، **والنفادُ يُختم** (`done`)
   * فلا يُعاد النداءُ على بِركةٍ فرغت — **ونداءٌ يعود فارغاً أبداً حلقةٌ
   * لا علف** (D-217).
   */
  const [page, setPage] = useState(0);
  const [done, setDone] = useState(false);
  const busy = useRef(false);
  const tail = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (busy.current || done) return;
    busy.current = true;
    try {
      const next = await moreTrailerClips({
        tab,
        scope,
        page: page + 1,
        perTitle: TRAILER_PER_TITLE,
        limit: TRAILER_FEED_LIMIT,
      });
      if (!next.length) {
        setDone(true);
        return;
      }
      setPage((p) => p + 1);
      /* **والمكرَّرُ يسقط عند الوصل**: **البِركةُ واحدةٌ ونافذتُها تتحرّك**
         — **ومقطعٌ يظهر مرّتين في علفٍ واحدٍ يُقرأ عطلاً** (D-756). */
      setExtra((previous) => {
        const seen = new Set([...items, ...previous].map(trailerClipKeyOf));
        return [...previous, ...next.filter((x) => !seen.has(trailerClipKeyOf(x)))];
      });
    } catch {
      /* دفعةٌ سقطت — الحارسُ باقٍ ويُعاد عند تقاطعٍ لاحق */
    } finally {
      busy.current = false;
    }
  }, [done, items, page, scope, tab]);

  useEffect(() => {
    const el = tail.current;
    if (!el || done || typeof IntersectionObserver === "undefined") return;
    /* **وهامشٌ سفليٌّ سخيّ**: **الدفعةُ تصل قبل أن يبلغ القارئُ الحافّة**
       — **فلا يرى فراغاً ينتظره** (D-198: الطرَفُ وعدٌ لا زينة). */
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      { rootMargin: "1200px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [done, loadMore]);

  const shown = slots.filter((i) => !gone.has(trailerKeyOf(i)));
  if (!shown.length) {
    return <p className="px-4 py-16 text-center text-sm text-muted">{emptyLabel ?? t.trailersEmpty}</p>;
  }

  return (
    /* ⚠️ **ولا `snap-*` هنا** (D-726): **الالتقاطُ يحتاج حاويةً تُمرَّر
       بنفسها** (`h-screen overflow-y-scroll`) **والصفحةُ تُمرَّر بجسدها**
       — **فالصنفُ كان سيُكتب ولا يفعل شيئاً.** 🔑 **والذي ينفّذ شرطَه
       («التمرير للأسفل يشغّل التالي ويوقف السابق») هو المراقبُ في
       المشغّل نفسِه** — **وصنفٌ خاملٌ يُقرأ ميزةً قائمةً فيُبنى فوقه.** */
    <TrailerPlayback
      soundPref={soundOn}
      /* 🆕 D-762: نصوصُ طبقة التكبير — وجودُها هو ما يفعّل التكبيرَ في هذا السطح */
      expandedLabels={{
        play: t.trailerPlay,
        mute: t.trailerMute,
        unmute: t.trailerUnmute,
        collapse: t.trailerCollapse,
        seek: t.trailerSeek,
        volume: t.trailerVolume,
      }}
      /* 🆕 D-1295: **اسمُ العمل وسطرُه ونبذتُه تحت المقطع المكبَّر، وزرُّ «مكتبتي» بجوار الاسم** (طلبُه:
         «ابغى زر اضافة ل ليست» · «خل اعلى نقطة له متساوية مع اسم الفلم وصغره درجه»). **الفعلُ فعلُ
         البطاقة نفسُه** (`addToList`) لا نسخةٌ ثانية — فما أُضيف هنا يظهر مضافاً في بطاقته عند التصغير.
         ⚠️ **والألوانُ بيضاءُ ثابتةٌ لا رموزُ السمة**: الستارةُ سوداءُ في النهار أيضاً، ورمزُ النصِّ في
         `daylight` داكنٌ فوقها. **والنبذةُ أربعةُ أسطرٍ هنا** — للنصِّ مكانٌ لا تملكه البطاقة (D-1291). */
      expandedInfo={(activeId) => {
        const i = shown.find((x) => trailerClipKeyOf(x) === activeId);
        if (!i) return null;
        const isAdded = added.has(trailerKeyOf(i));
        return (
          <>
            <div className="flex items-start gap-3">
              <h2 className="min-w-0 flex-1 truncate text-22 font-bold text-white">{i.title}</h2>
              <button
                type="button"
                onClick={() => addToList(i)}
                disabled={isAdded}
                /* **والحافّةُ العليا عند أعلى حروف الاسم** — نصفُ فراغ السطر فوقها. **والمرئيُّ ٢٨
                   واللمسُ ٤٤** (`before`): زرٌّ صغّره صاحبُه لا يُصغَّر هدفُه (D-033). */
                style={{ marginTop: "calc(var(--text-22) * 0.3)" }}
                className={`pointer-events-auto relative flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-3 text-12 font-medium whitespace-nowrap transition active:opacity-70 before:absolute before:-inset-2 before:content-[''] ${
                  isAdded ? "border-accent text-accent" : "border-white/40 text-white"
                }`}
              >
                <Icon name={isAdded ? "check" : "plus"} size={14} />
                {t.trailerMyList}
              </button>
            </div>
            <p className="mt-0.5 truncate text-14 text-white/65">
              {[i.year, i.genre, i.country].filter(Boolean).join(" · ")}
            </p>
            {i.overview && (
              <p className="mt-2.5 text-14 leading-relaxed text-white/85 line-clamp-4" dir="auto">
                {i.overview}
              </p>
            )}
          </>
        );
      }}
    >
    <div>
      {shown.map((i, index) => {
        /* 🆕 D-772: هويّةُ الخانة والمشغّل بالمقطع، والمتابعةُ بالعمل */
        const k = trailerClipKeyOf(i);
        const isAdded = added.has(trailerKeyOf(i));
        return (
          <section key={k} className="pb-4">
            <div className="rounded-2xl border border-border bg-surface overflow-hidden">
              <TrailerCardMedia
                id={k}
                item={{ keys: i.videoKeys, fileUrl: i.fileUrl, title: i.title }}
                backdrop={i.backdrop}
                title={i.title}
                eager={index === 0}
                playLabel={t.trailerPlay}
                pauseLabel={t.trailerPause}
                muteLabel={t.trailerMute}
                unmuteLabel={t.trailerUnmute}
                /* 🆕 D-762: أدواتُ التحكّم الكاملة في العلف وحدَه —
                   ⚖️ بلا إيقافٍ منذ D-771 (حكمه: «خله دائماً شغال») */
                withControls
                seekLabel={t.trailerSeek}
                volumeLabel={t.trailerVolume}
                expandLabel={t.trailerExpand}
                onUnavailable={() => retire(k)}
              />

              <div className="px-4 pt-3 pb-1.5">
                {/* 🆕 **ووسمُ المقطع بجوار الاسم** (D-772): **عملٌ يملك
                    أربعَ بطاقاتٍ في العلف** — **وبطاقتان بلا وسمٍ تُقرآن
                    تكراراً لا تنويعاً.** **والأولى بلا وسمٍ عمداً**: هي
                    الإعلانُ الرسميُّ وما بعده هو الذي يحتاج تعريفاً. */}
                <div className="flex items-baseline gap-2">
                  <h2 className="min-w-0 flex-1 text-22 font-bold truncate">{i.title}</h2>
                  {i.clipLabel && (
                    <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-0.5 text-12 font-semibold text-muted">
                      {i.clipLabel}
                    </span>
                  )}
                </div>
                {/* 🆕 **والنسبةُ بجوار التصنيف** (D-729، حكمُه) — سطرٌ
                    واحدٌ يجمع السنةَ والنوعَ والنسبة، **ولا سطرَ ثالثٌ
                    لكلمةٍ واحدة.** */}
                <p className="mt-0.5 text-14 text-muted truncate">
                  {[i.year, i.genre, i.country].filter(Boolean).join(" · ")}
                </p>
                {/* **والنبذةُ في الصفحة الكاملة وحدَها** (D-729) — **وفي صفِّ
                    اكتشف تُطيل البطاقةَ بلا أن تُقرأ** (D-510).
                    ⚖️ 🆕 **وثلاثةُ أسطرها صارت سطرين** (D-1291، بلاغُ أحمد:
                    «التفاصيل تحت المقطع ماخذه حجم اكبر من المقطع نفسه»):
                    **السطرُ الثالثُ كان ينتهي بـ«…» أصلاً والكاملُ خلف
                    «التفاصيل»** — **والمقطعُ هو سببُ الصفحة فلا يصغر عمّا
                    تحته.** ⚠️ **و`line-clamp` لا قصٌّ بالحروف**: القصُّ
                    الحسابيُّ يقطع الكلمةَ ويكذب على مقاسات الخطوط. */}
                {i.overview && (
                  <p className="mt-2 text-14 leading-relaxed line-clamp-2" dir="auto">
                    {i.overview}
                  </p>
                )}
                {/* **وسببُ الترشيح آخرَ الكتلة** — هو أضعفُها رتبةً */}
                {i.note && <p className="mt-2 text-14 text-muted truncate">{i.note}</p>}
              </div>

              {/* **ثلاثةُ أفعالٍ بوصفةٍ واحدة** — بعرضٍ متساوٍ، **وفاصلٌ
                  فوقها كفاصل بطاقة الملفّ** (D-687).
                  ⚖️ 🆕 **والرمزُ بجوار كلمته لا فوقها** (D-1291): **الصفُّ
                  كان ثلثَ ارتفاع التفاصيل ليحمل ثلاثَ كلمات** — **وسطرٌ
                  واحدٌ يحمل الأفعالَ نفسَها بثلثَي ارتفاعه.** */}
              <div className="mt-1 grid grid-cols-3 border-t border-[color:var(--divider)]">
                <Link
                  href={trailerTitleHref(i)}
                  prefetch={false}
                  className="flex items-center justify-center gap-2 py-3 text-12 text-muted whitespace-nowrap active:opacity-70 transition"
                >
                  <Icon name="info" size={21} />
                  {t.trailerDetails}
                </Link>
                <button
                  type="button"
                  onClick={() => addToList(i)}
                  disabled={isAdded}
                  className={`flex items-center justify-center gap-2 py-3 text-12 whitespace-nowrap active:opacity-70 transition ${
                    isAdded ? "text-accent" : "text-muted"
                  }`}
                >
                  <Icon name={isAdded ? "check" : "plus"} size={21} />
                  {t.trailerMyList}
                </button>
                <button
                  type="button"
                  onClick={() => notForMe(i)}
                  className="flex items-center justify-center gap-2 py-3 text-12 text-muted whitespace-nowrap active:opacity-70 transition"
                >
                  <Icon name="eye-off" size={21} />
                  {t.trailerNotForMe}
                </button>
              </div>
            </div>
          </section>
        );
      })}
      {/* **الحارسُ وسطرُ النهاية** — والنهايةُ تُقال ولا تُترك فراغاً */}
      <div ref={tail} aria-hidden className="h-px" />
      {done && (
        <p className="py-8 text-center text-12 text-muted">{t.trailerEnd}</p>
      )}
    </div>
    </TrailerPlayback>
  );
}
