"use client";

import Image from "next/image";
import { useState } from "react";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon, SectionTitle } from "./Icon";

/**
 * مشغّل الترايلر بواجهة مؤجّلة.
 *
 * لماذا لا نضع iframe يوتيوب مباشرةً: مشغّل يوتيوب وحده يقارب ميغابايت
 * من جافاسكربت لكل زيارة، ويُحمَّل حتى لو لم يضغط أحد. هنا نعرض صورة
 * العمل نفسها — وهي محمّلة أصلاً في الصفحة — ولا يُطلب المشغّل إلا بعد
 * الضغط. ونطاق nocookie حتى لا يُزرع تتبّع قبل التشغيل.
 */
export function Trailer({
  videoKey,
  title,
  thumbnail,
  locale,
}: {
  videoKey: string;
  title: string;
  thumbnail: string | null;
  locale: Locale;
}) {
  const t = getDict(locale);
  const [playing, setPlaying] = useState(false);

  return (
    <section aria-labelledby="trailer-heading">
      <SectionTitle icon="film" className="mb-3">
        <span id="trailer-heading">{t.trailerTitle}</span>
      </SectionTitle>

      <div className="relative aspect-video rounded-2xl overflow-hidden border border-border bg-surface-2">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoKey)}?autoplay=1&rel=0`}
            title={title}
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        ) : (
          <button
            onClick={() => setPlaying(true)}
            aria-label={t.trailerPlay}
            className="group absolute inset-0 w-full h-full"
          >
            {thumbnail && (
              <Image
                src={thumbnail}
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 720px"
                className="object-cover opacity-70 group-hover:opacity-90 transition"
              />
            )}
            <span className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />

            <span className="absolute inset-0 grid place-items-center">
              <span className="w-16 h-16 rounded-full bg-accent text-[color:var(--on-accent)] grid place-items-center shadow-lg group-hover:scale-110 transition">
                <Icon name="play" size={30} strokeWidth={1.6} />
              </span>
            </span>

            <span className="absolute inset-x-0 bottom-0 p-3 text-start">
              <span className="block text-sm font-bold text-white drop-shadow">
                {t.trailerPlay}
              </span>
            </span>
          </button>
        )}
      </div>
    </section>
  );
}
