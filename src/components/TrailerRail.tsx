"use client";

import Link from "next/link";
import { useState } from "react";
import { PosterRail } from "./PosterRail";
import { RailScroll } from "./RailScroll";
import { TrailerPlayer } from "./TrailerPlayer";
import { Icon } from "./Icon";
import { follow } from "@/lib/actions";
import { writeTrailerSound } from "@/lib/trailerPrefs";
import { flashError } from "@/lib/toast";
import { getDict, type Locale } from "@/lib/i18n";
import type { TrailerItem } from "@/lib/trailers";

/**
 * 🆕 **صفُّ «ترايلرات لك» في اكتشف** (D-726 → D-728).
 *
 * ⚖️ 🆕 **والصفُّ صار بطاقاتٍ كاملةً تُمرَّر لا بطاقةً وشريطَ مصغّرات**
 * (D-728، حكمُه بشطبٍ أزرقَ على المصغّرات ولقطةِ تصميمه): **المصغّرةُ
 * صورةٌ ساكنةٌ تَعِد بترايلرٍ ولا تعطيه** — **وضغطةٌ عليها تنقلك إلى
 * صفحةٍ أخرى لترى ما ظننتَه هنا** (D-217).
 * 🔑 **وطرفُ البطاقة التالية هو التعليمة**: عرضُ البطاقة `92vw` **فيبقى
 * ثُمنٌ ظاهراً** — **وصفٌّ أفقيٌّ بطاقتُه بعرض الشاشة كاملاً يُقرأ
 * بطاقةً واحدةً لا صفّاً**، **والطرفُ الظاهرُ يقول «مرّر» بلا كلمة.**
 *
 * ⚠️ **ومشغّلٌ لكلِّ بطاقةٍ لا يعني مشغّلاتٍ كثيرة**: **الإطارُ لا
 * يُركَّب حتى تبلغ بطاقتُه ٦٠٪** — **والتي خارج الشاشة لم تُركَّب قطّ**،
 * **وحارسُ الواحديّة يوقف السابقةَ حين تطالب اللاحقةُ بالدور** (D-726).
 * 🔑 **فشرطُ أحمد «لا تنشئ عدّة مشغّلات دفعةً واحدة» تنفّذه الرؤيةُ لا
 * عدّادٌ نكتبه.**
 *
 * ⚠️ **و`RailScroll` هي الحاوية** (القاعدة ٣): **وعرضُ البطاقة `vw`
 * لا `%`** — **حاويتُها `w-max` فالنسبةُ المئويّةُ تُقاس على عرضٍ غير
 * محدَّدٍ فتسقط إلى `auto`** — **ووحدةُ الشاشة تقيس ما نقصده فعلاً.**
 */
export function TrailerRail({
  items,
  locale,
  soundOn,
}: {
  items: TrailerItem[];
  locale: Locale;
  soundOn: boolean;
}) {
  const t = getDict(locale);
  /* **والصمتُ حالةُ الصفّ كلِّه لا حالةُ بطاقة** — يُرفع هنا فترثه
     البطاقاتُ كلُّها، **ويُكتب في الكوكي ليعيش بعد الإغلاق.** */
  const [muted, setMuted] = useState(!soundOn);
  const [added, setAdded] = useState<ReadonlySet<string>>(new Set());

  if (!items.length) return null;
  const keyOf = (i: TrailerItem) => `${i.mediaType}-${i.tmdbId}`;
  const feedHref = (i: TrailerItem) => `/trailers?at=${keyOf(i)}`;

  function changeMuted(next: boolean) {
    setMuted(next);
    /* 🔴 **والكوكي يُكتب هنا لا على الخادم** (D-747): **الفعلُ
       الخادميُّ يُعيد رسمَ الصفحة كلَّها** — **فضغطةُ سماعةٍ كانت
       تُعيد بناءَ الصفِّ الذي تنظر إليه.** */
    writeTrailerSound(next);
  }

  function addToList(i: TrailerItem) {
    const k = keyOf(i);
    setAdded((p) => new Set(p).add(k));
    follow({ tmdbId: i.tmdbId, mediaType: i.mediaType, title: i.title, posterPath: i.posterPath }).catch(
      (e) => {
        setAdded((p) => {
          const n = new Set(p);
          n.delete(k);
          return n;
        });
        flashError((e as Error).message);
      },
    );
  }

  return (
    <PosterRail bare title={t.trailersForYou} icon="play" href="/trailers" seeAllLabel={t.seeAll}>
      <RailScroll prevLabel="السابق / Previous" nextLabel="التالي / Next">
        {items.map((i) => {
          const isAdded = added.has(keyOf(i));
          return (
            <div
              key={keyOf(i)}
              className="snap-start shrink-0 w-[min(92vw,560px)] rounded-2xl border border-border bg-surface overflow-hidden"
            >
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
                href={feedHref(i)}
                openLabel={i.title}
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
                  {/* **السطرُ الثاني وصفةُ «مختار لك» نفسُها** — سنةٌ ونوع */}
                  <span className="mt-0.5 block truncate text-12 text-muted">
                    {[i.year, i.genre, i.country].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {/* **وفعلان لا ثلاثة في الصفّ** (تصميمُه): «ليس لي» فعلٌ
                    يحذف ما تراه، **وحذفٌ داخل صفٍّ يُمرَّر يزيح ما تحت
                    الإصبع** — **فبابُه الصفحةُ الكاملة حيث البطاقةُ وحدَها
                    في الشاشة.** */}
                <Link
                  href={`/${i.mediaType === "tv" ? "show" : "movie"}/${i.tmdbId}`}
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
