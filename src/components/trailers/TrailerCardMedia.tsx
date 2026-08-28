"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Icon } from "../Icon";
import {
  useTrailerPlayback,
  useTrailerSnapshot,
  type TrailerSlotItem,
} from "./TrailerPlaybackController";

/**
 * 🆕 **مساحةُ الفيديو في البطاقة** (D-759) — **صورةٌ وأزرارٌ فقط، بلا
 * أيِّ مشغّل**: طبقةُ المتحكّم تحت الغلاف من أوّل لحظة، والغلافُ فوقَها
 * سِترٌ يتلاشى بعد ثبوت الحركة (لا شاشةَ سوداء أبداً — ⚖️ عُكس الترتيبُ
 * بعد فشل اختبار iPhone في ٢٨ أغسطس).
 *
 * **زرُّ التشغيل** يظهر في: موفّر البيانات (كلُّ بطاقة) · الحظر
 * (`onAutoplayBlocked`) · التعثّر (٨ ثوانٍ بلا إطار) · الإيقاف — وضغطتُه
 * تنفّذ `playVideo` داخل الإيماءة نفسِها (المواصفة رابعًا/٨).
 *
 * **زرُّ الصوت** يعرض الحالةَ **الفعليّة** المقروءةَ من المشغّل — لا
 * الرغبة (المواصفة خامسًا/٦)، ولا يفتح صفحةً ولا يعيد بناء شيء.
 *
 * **الوقتُ نصٌّ للقراءة فقط** — ⚖️ التقديمُ محذوفٌ بأمر صاحبه في هذه
 * المرحلة: لا `role="slider"` ولا `seekTo` ولا التقاطَ مؤشّر.
 */

function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function TrailerCardMedia({
  id,
  item,
  backdrop,
  title,
  eager = false,
  href,
  openLabel,
  playLabel,
  muteLabel,
  unmuteLabel,
  onOpen,
  onUnavailable,
}: {
  id: string;
  item: TrailerSlotItem;
  backdrop: string | null;
  title: string;
  eager?: boolean;
  href?: string;
  openLabel?: string;
  playLabel: string;
  muteLabel: string;
  unmuteLabel: string;
  onOpen?: () => void;
  onUnavailable?: () => void;
}) {
  const api = useTrailerPlayback();
  const snap = useTrailerSnapshot();
  const area = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    if (onUnavailable) api.registerUnavailable(id, onUnavailable);
    return api.register(id, el, item);
    // البنودُ هويّةُ البطاقة — تسجيلٌ واحدٌ لعمرها
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, api]);

  const isActive = snap.activeId === id;
  const playing = isActive && snap.phase === "playing";
  const showsPlayButton =
    (isActive && (snap.phase === "paused" || snap.phase === "blocked" || snap.phase === "stalled")) ||
    (!playing && snap.manualOnly);

  return (
    <div ref={area} className="relative aspect-video w-full overflow-hidden bg-surface-2">
      {/* 🔴 ⚖️ الغلافُ هو السِّترُ نفسُه بعد فشل iPhone (بلاغ ٢٨ أغسطس):
          طبقةُ المشغّل تحته ظاهرةٌ من أوّل لحظة (فلا يحاول iOS تشغيلَ
          فيديو في طبقةٍ غير مرسومة)، وهو **فوقَها** (z-40) يتلاشى فقط
          بعد أن يثبت تحرّكُ العقرب — ثم `invisible` بعد تمام الانتقال
          (خاصّية visibility تنقلب في آخره لا أثناءه). فلا شاشةَ سوداء
          أبداً، ولا غلافَ فوق فيديو يعمل. */}
      {backdrop ? (
        <Image
          src={backdrop}
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1080px) 92vw, 1030px"
          className={`pointer-events-none z-40 object-cover transition-[opacity,visibility] duration-300 ${
            playing ? "invisible opacity-0" : "visible opacity-100"
          }`}
          priority={eager}
          fetchPriority={eager ? "high" : "auto"}
        />
      ) : null}

      {/* بابُ الصفحة الكاملة — على مقطعٍ يعمل فقط (D-743: الضغطةُ على
          الواقف تعني «شغّله» لا «انقلني») */}
      {href && playing ? (
        <Link
          href={href}
          prefetch={false}
          aria-label={openLabel ?? title}
          className="absolute inset-0 z-40"
          onClick={onOpen}
        />
      ) : null}

      {!playing ? (
        <button
          type="button"
          onClick={() => api.tapPlay(id)}
          aria-label={playLabel}
          aria-hidden={!showsPlayButton}
          tabIndex={showsPlayButton ? 0 : -1}
          className="absolute inset-0 z-50 grid place-items-center"
        >
          {showsPlayButton ? (
            <span className="grid h-14 w-14 place-items-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-sm">
              <Icon name="play" size={26} />
            </span>
          ) : null}
        </button>
      ) : null}

      {/* 🔴 زرُّ الصوت — **لبطاقةٍ تعمل فعلاً وحدَها**: على iPhone كان
          يظهر أثناء الحظر فصار هو زرَّ التشغيل الفعليّ. الأيقونةُ من
          الحالة المُتحقَّقة، والتشغيلُ لزرِّ التشغيل وحدَه. */}
      {playing ? (
        <button
          type="button"
          onClick={() => api.tapSound()}
          aria-label={snap.soundOn ? muteLabel : unmuteLabel}
          className="absolute end-2.5 top-2.5 z-50 grid h-9 w-9 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm transition active:opacity-70"
        >
          <Icon name={snap.soundOn ? "volume" : "volume-off"} size={17} />
        </button>
      ) : null}

      {/* الوقتُ نصّاً — بلا شريطِ تقديمٍ في هذه المرحلة (المواصفة سابعًا) */}
      {isActive && snap.time ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-50 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6">
          <span dir="ltr" className="block text-12 tabular-nums text-white/90">
            {clock(snap.time.now)} / {clock(snap.time.total)}
          </span>
        </div>
      ) : null}
    </div>
  );
}
