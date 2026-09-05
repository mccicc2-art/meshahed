"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { PosterRail } from "./PosterRail";
import { RailScroll } from "./RailScroll";
import { TrailerPlayback } from "./trailers/TrailerPlaybackController";
import { TrailerCardMedia } from "./trailers/TrailerCardMedia";
import { Icon } from "./Icon";
import {
  trailerClipKeyOf,
  trailerKeyOf,
  trailerTitleHref,
  useTrailerFollow,
  useTrailerSlots,
} from "@/lib/trailerCard";
import { getDict, type Locale } from "@/core/i18n";
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
 * 🔴 **ومشغّلٌ واحدٌ للسطح كلِّه** (D-759، مواصفةُ أحمد): البطاقاتُ
 * صورٌ وأزرارٌ فقط، **والمشغّلُ طبقةُ `TrailerPlayback` الواحدة** —
 * فلا iframe لكلِّ بطاقةٍ ولا تداخلَ مقاطعَ أصلاً.
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
      {/* متحكّمٌ واحدٌ للسطح كلِّه — مشغّلٌ واحدٌ في DOM (D-759) */}
      <TrailerPlayback soundPref={soundOn}>
      <RailScroll prevLabel="السابق / Previous" nextLabel="التالي / Next">
        {slots.map((i, index) => {
          /* 🆕 D-772: هويّةُ البطاقة بالمقطع (خانةٌ ومشغّلٌ ومفتاحُ React)،
             و«أضف لمكتبتي» بالعمل — حكمان لا حكم */
          const k = trailerClipKeyOf(i);
          const isAdded = added.has(trailerKeyOf(i));
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
              /* ⚖️ 🆕 **والسقفُ نزل وصار يتبع ارتفاعَ الشاشة** (D-862،
                 حكمُ أحمد بلقطةِ حاسوب: «الترايلر جدا كبير في الكمبيوتر
                 صغّره»): **مقيسٌ قبل التغيير** — 1030×647 على نافذةٍ
                 1912×948، **أي ٦٨٪ من ارتفاع الشاشة لبطاقةٍ واحدة.**
                 🔑 **والقيدُ ارتفاعٌ لا عرض**: الشكوى «طوله» والبطاقةُ
                 16:9، **فسقفٌ بالبكسل وحدَه يصلح شاشةً ويخطئ أختَها** —
                 و`45dvh` تُبقي المقطعَ نصفَ الشاشة تقريباً في ٧٦٨ و٩٤٨
                 و١٠٨٠ سواء، و`760px` سقفٌ أعلى للشاشات الطويلة.
                 ⚠️ **والثمنُ معلَنٌ لا مكتوم**: الرافّةُ ثابتةٌ عند
                 1152px، **فكلُّ بكسلٍ يُخصم من البطاقة يزيد طرَفَ التالية**
                 (كان 110px ويصير ~380px). **وشرطُ D-755 محفوظٌ في حدّه
                 الحاسم**: بطاقتان كاملتان تحتاجان عرضاً ≤570px، **ولا
                 يبلغه أيُّ مقاسٍ هنا** — فالثانيةُ مقصوصةٌ دائماً.
                 ⚠️ **و`92vw` أوّلُ الثلاثة على الجوّال** فلا يتغيّر شيء. */
              /* 🔴 🆕 **`isolate` — وبها ظهر سهما التمرير** (D-911، بلاغُ أحمد
                 بلقطةِ حاسوب: «ما فيه سهم أقدر أمرّر الفيديوهات يمين ويسار»).
                 **والسهمان كانا مرسومَين طوالَ الوقت**: `RailScroll` تضعهما
                 عند `z-10`، **وغلافُ البطاقة صورةٌ ممتدّةٌ عند `z-40`**
                 (D-879) — **و`relative` بلا `z-index` لا تصنع سياقَ تراصٍّ**،
                 فطبقاتُ البطاقة الداخليّة تتسلّق إلى سياق الصفحة وتدفن ما
                 دونها. **فلم يكن السهم غائباً بل مدفوناً**، ولا يُنقر أيضاً.
                 🔑 **والعلاجُ حبسُ الطبقات لا رفعُ السهم**: رفعُه فوق ٤٠
                 يجعله يعلو ترويستَنا اللاصقة يوماً ما — **و`isolate` تقول
                 «أرقامي الداخليّة شأني»** فيعود ترتيبُ الصفّ إلى الطبيعة.
                 ⚖️ **والجذرُ الأعمق كلمةٌ واحدةٌ في `TrailerCardMedia`**
                 (حيث تسكن `z-40`/`z-50`)، **وهنا يكفي لهذا الصفّ.**
                 مُثبَتٌ في متصفّحٍ حقيقيّ بـ`elementFromPoint` عند مركز
                 السهم: قبلها الغلاف، وبعدها السهم. */
              className="snap-start shrink-0 isolate rounded-2xl border border-border bg-surface overflow-hidden"
              style={{ width: "min(92vw, calc(45dvh * 16 / 9), 760px)" }}
            >
              <TrailerCardMedia
                id={k}
                item={{ keys: i.videoKeys, fileUrl: i.fileUrl, title: i.title }}
                backdrop={i.backdrop}
                title={i.title}
                /* أوّلُ بطاقةٍ فوق الطيّة (D-756): صورتُها بأولويّة */
                eager={index === 0}
                playLabel={t.trailerPlay}
                pauseLabel={t.trailerPause}
                muteLabel={t.trailerMute}
                unmuteLabel={t.trailerUnmute}
                /* 🆕 D-878 (حكمه بلقطة): **شريطُ التقديم في الرايل أيضاً** —
                   كان للعلف وحدَه (D-762)، **وما يُقدَّم في صفحةٍ يُقدَّم في
                   الصفّ الذي يفتحها** (D-199). */
                seekLabel={t.trailerSeek}
                onUnavailable={() => retire(k)}
              />

              <div className="flex items-center gap-3 px-3.5 py-3">
                <span className="min-w-0 flex-1">
                  <Link
                    href={feedHref(i)}
                    prefetch={false}
                    className="block truncate font-bold text-15"
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
      </TrailerPlayback>
    </PosterRail>
  );
}
