"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { PosterRail } from "./PosterRail";
import { RailScroll } from "./RailScroll";
import { TrailerPlayer } from "./TrailerPlayer";
import { Icon } from "./Icon";
import { setTrailerSound } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import type { TrailerItem } from "@/lib/trailers";

/**
 * 🆕 **صفُّ «ترايلرات لك» في اكتشف** (D-726).
 *
 * ⚠️ **ورأسُه `PosterRail` بـ`bare` لا ترويسةٌ ثانية** (D-428/القاعدة ٣):
 * **العنوانُ ورابطُ «الكلّ» هما مشترَكُ كلِّ صفوف الصفحة** — **وقسمٌ
 * يرسم رأسَه بيده يفترق عن أخواته أوّلَ يومٍ يتغيّر مقاسُ العنوان.**
 *
 * 🔑 **ومشغّلٌ واحدٌ في الصفّ لا مشغّلٌ لكلِّ بطاقة** (شرطُ أحمد: «لا
 * تنشئ عدّة مشغّلات دفعةً واحدة»): **البطاقةُ الأولى تُشغَّل، وما
 * بعدَها ملصقاتٌ تفتح الصفحةَ الكاملة** — **وصفٌّ أفقيٌّ فيه خمسةُ
 * إطارات يوتيوب صفحةٌ لا تُفتح.**
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
  /* **والصمتُ حالةُ الصفحة كلِّها لا حالةُ بطاقة** — يُرفع هنا فيرثه
     المشغّلُ، **ويُكتب في الكوكي ليعيش بعد الإغلاق.** */
  const [muted, setMuted] = useState(!soundOn);

  if (!items.length) return null;
  const [lead, ...rest] = items;
  const href = (i: TrailerItem) => `/trailers?at=${i.mediaType}-${i.tmdbId}`;

  function changeMuted(next: boolean) {
    setMuted(next);
    /* **ولا انتظارَ للخادم**: الصوتُ يتبدّل في الإطار فوراً،
       **والكوكي أثرٌ يلحق** (فشلُه لا يُبطل الضغطة). */
    setTrailerSound(!next).catch(() => {});
  }

  return (
    <PosterRail
      bare
      title={t.trailersForYou}
      icon="play"
      href="/trailers"
      seeAllLabel={t.seeAll}
    >
      <div className="rounded-2xl border border-border bg-surface overflow-hidden">
        <TrailerPlayer
          videoKey={lead.videoKey}
          backdrop={lead.backdrop}
          title={lead.title}
          muted={muted}
          onMutedChange={changeMuted}
          playLabel={t.trailerPlay}
          muteLabel={t.trailerMute}
          unmuteLabel={t.trailerUnmute}
          className="aspect-video w-full"
          href={href(lead)}
          openLabel={lead.title}
        />

        <div className="flex items-center gap-3 px-3.5 py-3">
          <span className="min-w-0 flex-1">
            <Link href={href(lead)} prefetch={false} className="block truncate font-bold text-16">
              {lead.title}
            </Link>
            {/* **السطرُ الثاني وصفةُ «مختار لك» نفسُها** — سنةٌ ونوعٌ
                وسببٌ بلغة القارئ (D-494). */}
            <span className="mt-0.5 block truncate text-12 text-muted">
              {[lead.year, lead.genre].filter(Boolean).join(" · ")}
            </span>
          </span>
          <Link
            href={`/${lead.mediaType === "tv" ? "show" : "movie"}/${lead.tmdbId}`}
            prefetch={false}
            className="shrink-0 flex flex-col items-center gap-1 text-12 text-muted active:opacity-70 transition"
          >
            <Icon name="info" size={19} />
            {t.trailerDetails}
          </Link>
        </div>
      </div>

      {/* **وبقيّةُ الصفّ ملصقاتٌ ساكنة** — بابُها الصفحةُ الكاملة من
          موضعِ العمل نفسِه (شرطُه: «الضغط على فيديو يفتح الـFeed من
          نفس العمل»). */}
      {/* ⚠️ **و`RailScroll` لا حاويةٌ ثانية** (D-002/القاعدة ٣): وصفتُها
          تحمل أسهمَ سطح المكتب وهوامشَ الحافّة والالتقاطَ وإخفاءَ شريط
          التمرير — **وكنتُ كتبتُ `scrollbar-none` وهو صنفٌ لا وجودَ له
          في هذا المشروع** (فخُّ الأصناف الخرساء، D-684): **يُكتب فيُقرأ
          ميزةً ولا يفعل شيئاً.** */}
      {rest.length > 0 && (
        <div className="mt-3">
        <RailScroll prevLabel="السابق / Previous" nextLabel="التالي / Next">
          {rest.map((i) => (
            <Link
              key={`${i.mediaType}-${i.tmdbId}`}
              href={href(i)}
              prefetch={false}
              className="shrink-0 w-40 active:opacity-70 transition"
            >
              {/* 🔴 **و`next/image` لا `<img>` خام** (D-726، عطلٌ قِيس على
                  النشرة الحيّة): **كتبتُ وسماً خاماً فخرجت الخمسُ صوراً
                  مكسورة** — **وطلبٌ مباشرٌ إلى `image.tmdb.org` من هذه
                  الصفحة يفشل** (جرّبتُه في المتصفّح: `onerror`)، **بينما
                  المسارُ عبر `/_next/image` يعمل في كلِّ ملصقٍ في
                  التطبيق منذ يومه.** 🔑 **والدرسُ لا يحتاج تشخيصَ السبب**:
                  **وسيلةٌ واحدةٌ لرسم الصورة في التطبيق كلِّه** (القاعدة ٣)،
                  **ومن خرج عنها دفع ثمنَ اكتشافِ سببٍ لا يعنيه.** */}
              <span className="relative block aspect-video rounded-xl overflow-hidden bg-surface-2">
                {i.backdrop && (
                  <Image src={i.backdrop} alt="" fill sizes="160px" className="object-cover" />
                )}
                <span className="absolute inset-0 grid place-items-center">
                  <span className="w-9 h-9 rounded-full bg-black/55 text-white grid place-items-center">
                    <Icon name="play" size={17} />
                  </span>
                </span>
              </span>
              <span className="mt-1.5 block truncate text-12">{i.title}</span>
            </Link>
          ))}
        </RailScroll>
        </div>
      )}
    </PosterRail>
  );
}
