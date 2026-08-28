"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { PosterRail } from "./PosterRail";
import { RailScroll } from "./RailScroll";
import { TrailerPlayer } from "./TrailerPlayer";
import { Icon } from "./Icon";
import {
  trailerKeyOf,
  trailerTitleHref,
  useTrailerFollow,
  useTrailerSlots,
  useTrailerSound,
} from "@/lib/trailerCard";
import { getDict, type Locale } from "@/lib/i18n";
import type { TrailerItem, TrailerScope } from "@/lib/trailers";

/**
 * 🆕 **صفُّ «ترايلرات لك» في اكتشف** (D-726 → D-728).
 *
 * ⚖️ **والصفُّ بطاقاتٌ كاملةٌ تُمرَّر لا بطاقةٌ وشريطُ مصغّرات** (D-728):
 * **المصغّرةُ صورةٌ ساكنةٌ تَعِد بترايلرٍ ولا تعطيه** — **وضغطةٌ عليها
 * تنقلك إلى صفحةٍ أخرى لترى ما ظننتَه هنا** (D-217).
 * 🔑 **وطرفُ البطاقة التالية هو التعليمة**: **بطاقةٌ بعرض الحاوية كاملاً
 * تُقرأ بطاقةً واحدةً لا صفّاً**، **والطرَفُ الظاهرُ يقول «مرّر» بلا
 * كلمة** (D-755).
 *
 * ⚠️ **ومشغّلٌ لكلِّ بطاقةٍ لا يعني مشغّلاتٍ كثيرة**: **الإطارُ لا
 * يُركَّب حتى يأتيَ البطاقةَ الدور** (D-756)، **وحارسُ الواحديّة يوقف
 * السابقةَ حين تطالب اللاحقةُ به** (D-726) — **فشرطُ «لا تنشئ عدّة
 * مشغّلات دفعةً واحدة» تنفّذه الرؤيةُ لا عدّادٌ نكتبه.**
 *
 * ⚠️ **و`RailScroll` هي الحاوية** (القاعدة ٣)، **والوصفاتُ المشتركةُ مع
 * العلف في `trailerCard.ts`** (D-756).
 */

/** **ما يُعرض من الصفّ** — وما زاد عليه في `items` بدائلُ خاناته (D-756) */
const RAIL_SLOTS = 6;

export function TrailerRail({
  items,
  locale,
  soundOn,
  scope,
}: {
  items: TrailerItem[];
  locale: Locale;
  soundOn: boolean;
  scope: TrailerScope;
}) {
  const t = getDict(locale);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { muted, changeMuted } = useTrailerSound(soundOn);
  const { added, addToList } = useTrailerFollow();
  const { slots, retire } = useTrailerSlots(items, RAIL_SLOTS);

  if (!slots.length) return null;
  const origin = `${pathname}${searchParams.size ? `?${searchParams.toString()}` : ""}`;
  const feedHref = (i?: TrailerItem) => {
    const params = new URLSearchParams({ scope, from: origin });
    if (i) params.set("at", trailerKeyOf(i));
    return `/trailers?${params.toString()}`;
  };

  return (
    <PosterRail bare title={t.trailersForYou} icon="play" href={feedHref()} seeAllLabel={t.seeAll}>
      <RailScroll prevLabel="السابق / Previous" nextLabel="التالي / Next">
        {slots.map((i, index) => {
          const k = trailerKeyOf(i);
          const isAdded = added.has(k);
          return (
            <div
              key={k}
              /* 🔴 **بطاقةٌ واحدةٌ والثانيةُ طرَفٌ — على كلِّ عرض** (D-755،
                 حكمُ أحمد: «المفروض مقطع فيديو واحد والثاني يبان طرفه مثل
                 الجوال»). **والسقفُ ٥٦٠ كان يُنتج بطاقتين كاملتين بالضبط**
                 (مساحةُ الرافّة ١١٢٠px، و٥٦٠+١٢+٥٦٠ = ١١٣٢) — **ورقمٌ
                 صحيحٌ لعرضٍ واحدٍ يصير خطأً في الثاني.**
                 🔑 **والطرَفُ وعدٌ لا زينة**: **بطاقتان كاملتان تقولان
                 «هذا كلُّ ما هناك»، والطرَفُ يقول «وراءه المزيد»** (D-198).
                 ⚠️ **والثمنُ معلَن**: البطاقةُ تكبر على الشاشات العريضة
                 (١٠٣٠×٥٨٠) فتدفع ما تحتها لأسفل. */
              className="snap-start shrink-0 w-[min(92vw,1030px)] rounded-2xl border border-border bg-surface overflow-hidden"
            >
              <TrailerPlayer
                videoKey={i.videoKey}
                videoKeys={i.videoKeys}
                fileUrl={i.fileUrl}
                backdrop={i.backdrop}
                title={i.title}
                muted={muted}
                onMutedChange={changeMuted}
                playLabel={t.trailerPlay}
                muteLabel={t.trailerMute}
                unmuteLabel={t.trailerUnmute}
                seekLabel={t.trailerSeek}
                className="aspect-video w-full"
                /* 🆕 **وأوّلُ بطاقةٍ فوق الطيّة** (D-756): **صورتُها أوّلُ
                   ما تراه العينُ في اكتشف** — **والتأجيلُ لما يُرى الآن
                   تأخيرٌ لا اقتصاد.** */
                eager={index === 0}
                href={feedHref(i)}
                openLabel={i.title}
                onUnavailable={() => retire(k)}
              />

              <div className="flex items-center gap-3 px-3.5 py-3">
                <span className="min-w-0 flex-1">
                  <Link
                    href={feedHref(i)}
                    prefetch={false}
                    className="block truncate font-bold text-16"
                  >
                    {i.title}
                  </Link>
                  {/* **السطرُ الثاني وصفةُ «مختار لك» نفسُها** — سنةٌ ونوعٌ ونسبة */}
                  <span className="mt-0.5 block truncate text-12 text-muted">
                    {[i.year, i.genre, i.country].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {/* **وفعلان لا ثلاثة في الصفّ** (تصميمُه): «ليس لي» فعلٌ
                    يحذف ما تراه، **وحذفٌ داخل صفٍّ يُمرَّر يزيح ما تحت
                    الإصبع** — **فبابُه الصفحةُ الكاملة حيث البطاقةُ وحدَها
                    في الشاشة.** */}
                <Link
                  href={trailerTitleHref(i)}
                  prefetch={false}
                  className="shrink-0 flex flex-col items-center gap-1 text-12 text-muted active:opacity-70 transition"
                >
                  <Icon name="info" size={19} />
                  {t.trailerDetails}
                </Link>
                <button
                  type="button"
                  onClick={() => addToList(i)}
                  disabled={isAdded}
                  className={`shrink-0 flex flex-col items-center gap-1 text-12 active:opacity-70 transition ${
                    isAdded ? "text-accent" : "text-muted"
                  }`}
                >
                  <Icon name={isAdded ? "check" : "plus"} size={19} />
                  {t.trailerMyList}
                </button>
              </div>
            </div>
          );
        })}
      </RailScroll>
    </PosterRail>
  );
}
