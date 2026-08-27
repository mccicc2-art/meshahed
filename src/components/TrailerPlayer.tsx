"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

/**
 * 🆕 **مشغّلُ مقطعٍ واحد** (D-726) — **قلبُ الميزة كلِّها.**
 *
 * 🔴 **والحقيقةُ التي تحكم كلَّ سطرٍ هنا: TMDB لا يخزّن ملفَّ فيديو، بل
 * مفتاحَ يوتيوب.** فلا `<video>` ولا تحكّمٌ أصيل — **والمشغّلُ إطارٌ
 * يحمل صفحةَ يوتيوب كاملة.**
 *
 * 🔑 **وثلاثةُ قراراتٍ تنبع من ذلك مباشرة:**
 *
 * **١) لا نُحمّل `iframe_api` أبداً** (~١ ميغابايت — وهو ما حذّر منه
 * `Trailer.tsx` منذ يومه). **و`enablejsapi=1` وحدَها تكفي**: الأوامرُ
 * تُرسل `postMessage` إلى `contentWindow` مباشرةً، **والحالةُ تعود في
 * `infoDelivery`** — **فصفرُ بايتٍ من جافاسكربت يوتيوب.**
 * ⚠️ **و`infoDelivery` غيرُ موثَّقة**: فشريطُ التقدّم **يظهر إن وصلت
 * البيانات ويغيب إن لم تصل** — **ولا يُبنى شيءٌ يعتمد عليها** (D-217:
 * لا وعدَ لا يقدر رقمٌ على الوفاء به).
 *
 * **٢) الإطارُ لا يُركَّب حتى يُرى** — `IntersectionObserver` بعتبة
 * ٦٠٪ (شرطُ أحمد حرفاً)، **ثمّ في وقتِ الخمول** (`requestIdleCallback`):
 * **حكمُه في هذه الجولة: «تلقائيّ بعد استقرار الصفحة»** — **فسرعةُ فتح
 * Discover المحسوسةُ لا تُمسّ، والكلفةُ باندويثٌ في الخلفيّة.**
 *
 * **٣) مشغّلٌ واحدٌ في التطبيق كلِّه** — **سجلٌّ على مستوى الوحدة لا
 * حالةٌ في مكوّن**: الرايلُ والصفحةُ الكاملةُ شجرتان مختلفتان،
 * **ومَن حرس الواحديّةَ داخل قائمةٍ سمع صوتين حين يفتح القارئُ الصفحةَ
 * والرايلُ خلفه حيّ.**
 */

/** 🔑 **حارسُ الواحديّة** — آخرُ مشغّلٍ طالب بالدور، وموقِفُه */
let CURRENT: (() => void) | null = null;

function claim(stop: () => void) {
  if (CURRENT && CURRENT !== stop) CURRENT();
  CURRENT = stop;
}
function release(stop: () => void) {
  if (CURRENT === stop) CURRENT = null;
}

/** **الأصلُ الوحيدُ الذي نقبل منه رسالة** — بابٌ يُقفل من جهته */
const YT_ORIGIN = "https://www.youtube-nocookie.com";

/**
 * **توفيرُ البيانات يُقرأ لا يُخمَّن** — وصفةُ `prefetchIntent` و`BottomNav`
 * حرفاً (القاعدة ٦)، **فبطيءُ الشبكة والمقتصِدُ يُعاملان معاملةً واحدة.**
 */
function isSaving(): boolean {
  try {
    const c = (
      navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }
    ).connection;
    return Boolean(c?.saveData) || Boolean(c?.effectiveType?.includes("2g"));
  } catch {
    return false;
  }
}

function idle(run: () => void): () => void {
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    cancelIdleCallback?: (h: number) => void;
  };
  if (typeof w.requestIdleCallback === "function") {
    const h = w.requestIdleCallback(run, { timeout: 1500 });
    return () => w.cancelIdleCallback?.(h);
  }
  const h = window.setTimeout(run, 300);
  return () => window.clearTimeout(h);
}

function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function TrailerPlayer({
  videoKey,
  backdrop,
  title,
  muted,
  onMutedChange,
  playLabel,
  muteLabel,
  unmuteLabel,
  className = "",
  showProgress = true,
  href,
  openLabel,
}: {
  videoKey: string;
  backdrop: string | null;
  title: string;
  muted: boolean;
  onMutedChange: (next: boolean) => void;
  playLabel: string;
  muteLabel: string;
  unmuteLabel: string;
  className?: string;
  showProgress?: boolean;
  /**
   * 🆕 **وجهةُ الضغط على الصورة** (D-726) — **ويُرسم الرابطُ هنا لا
   * حول المكوّن**: 🔴 **غلافُ `<Link>` يبتلع مفتاحَ الصوت** — الزرُّ
   * يقع داخله فتُقرأ ضغطتُه ملاحةً، **ومَن أراد إسكاتَ الفيديو فتح
   * صفحةً.** 🔑 **والطبقاتُ لا تُصلحها الأخوّة**: المشغّلُ سياقُ
   * تكديسٍ مغلق، **فرابطٌ أخٌ فوقه يغطّي أزرارَه كلَّها مهما رُفعت
   * داخله** — **فمن ملك الطبقاتِ يملك البابَ.**
   */
  href?: string;
  openLabel?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [mounted, setMounted] = useState(false);
  /** **صورةُ الخلفيّة تبقى فوق الإطار حتى يبدأ الرسم فعلاً** — شرطُ
      أحمد: «لا شاشة سوداء ولا تغيّر في ارتفاع الكارد» */
  const [playing, setPlaying] = useState(false);
  const [held, setHeld] = useState(false);
  const [at, setAt] = useState<{ now: number; total: number } | null>(null);

  const send = useCallback((func: string, args: unknown[] = []) => {
    try {
      frame.current?.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func, args }),
        YT_ORIGIN,
      );
    } catch {
      /* الإطارُ لم يُركّب بعد أو غادر — لا شيءَ يُنقذ */
    }
  }, []);

  const stop = useCallback(() => {
    send("pauseVideo");
    setPlaying(false);
  }, [send]);

  /* ===== ١) الرؤيةُ تقرّر التركيبَ والتشغيل ===== */
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    /* **وبيئةٌ بلا مراقبٍ لا تُترك بلا باب** — تُرسم الصورةُ وزرُّها
       (وصفةُ `StickyStuck` في الحارس). */
    if (typeof IntersectionObserver === "undefined") {
      setHeld(true);
      return;
    }
    if (isSaving()) {
      /* ⚠️ **شرطُه**: «عند تفعيل توفير البيانات يتوقف التشغيل التلقائي
         وتظهر صورة مع زرّ تشغيل» — **ولا رسالةَ خطأ**، الزرُّ هو الجواب. */
      setHeld(true);
      return;
    }

    let cancelIdle: (() => void) | null = null;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && e.intersectionRatio >= 0.6) {
          claim(stop);
          cancelIdle?.();
          cancelIdle = idle(() => {
            setMounted(true);
            send("playVideo");
          });
        } else {
          cancelIdle?.();
          cancelIdle = null;
          stop();
          release(stop);
          /* 🆕 **والخارجُ من الشاشة يُفكَّك لا يُوقَف وحسب** (D-728):
             **إطارٌ موقوفٌ يبقى صفحةَ يوتيوب حيّةً في الذاكرة** —
             **وصفٌّ من ستٍّ يُمرَّر كلُّه يترك ستَّ صفحاتٍ خلفه**،
             **وهو بعينه ما منعه شرطُ أحمد «لا تنشئ عدّة مشغّلات».**
             ⚠️ **والثمنُ معلَن**: العودةُ إليه تُعيد التحميل من الصفر —
             **وذاكرةٌ تُحرَّر أرخصُ من تحميلٍ يتكرّر**، ولا ثالثَ لهما. */
          if (!e.isIntersecting) {
            setMounted(false);
            setAt(null);
          }
        }
      },
      { threshold: [0, 0.6, 1] },
    );
    io.observe(el);
    return () => {
      cancelIdle?.();
      io.disconnect();
      release(stop);
    };
  }, [send, stop]);

  /* ===== ٢) التطبيقُ يذهب للخلفيّة فيصمت ===== */
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") stop();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", stop);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", stop);
    };
  }, [stop]);

  /* ===== ٣) ما يعود من الإطار: أوّلُ رسمٍ وشريطُ التقدّم ===== */
  useEffect(() => {
    if (!mounted) return;
    /** **ويسكت النداءُ عند أوّل جواب** — لا نبضَ بلا حاجة */
    let got = false;
    function onMsg(e: MessageEvent) {
      if (e.origin !== YT_ORIGIN) return;
      let d: { event?: string; info?: { currentTime?: number; duration?: number; playerState?: number } };
      try {
        d = typeof e.data === "string" ? JSON.parse(e.data) : (e.data as typeof d);
      } catch {
        return;
      }
      const info = d?.info;
      if (!info) return;
      /* 🔴 **والصورةُ لا تُرفع حتى يقول الإطارُ «أنا أرسم»** (D-729،
         عطلٌ في لقطته: **مساحةُ الفيديو خرجت بيضاءَ في صفحة الترايلرات**).
         🔑 **كنتُ أرفعها لحظةَ التركيب** — **والتركيبُ ليس الرسم**:
         إطارُ يوتيوب يبدأ أبيضَ ويظلّ كذلك ثوانيَ حتى يصل المقطع،
         **فرفعتُ السترَ عن فراغٍ أبيض.** **وشرطُ أحمد كان صريحاً:
         «أثناء التحميل تظهر صورة Backdrop بدون شاشة سوداء»** — **والبيضاءُ
         أسوأُ من السوداء في سطحٍ داكن.**
         ⚠️ **وحالةُ التشغيل هي الإشارة الصادقة** (`playerState === 1`). */
      /* 🔑 **وأصدقُ دليلٍ على الرسم عقربٌ تحرّك** (D-729، بعد أوّل
         قياسٍ حيّ): **`playerState === 1` تصل والمقطعُ ما زال يُخزَّن**،
         **و«0:00 / 2:42» تقول إنه لم يبدأ بعد.** **فالشرطُ حالةُ تشغيلٍ
         مع زمنٍ تجاوز الصفر** — **حالةٌ بلا زمنٍ نيّةٌ لا فعل.** */
      if (
        info.playerState === 1 &&
        typeof info.currentTime === "number" &&
        info.currentTime > 0.1
      ) {
        setPlaying(true);
      }
      if (
        showProgress &&
        typeof info.currentTime === "number" &&
        typeof info.duration === "number" &&
        info.duration > 0
      ) {
        got = true;
        setAt({ now: info.currentTime, total: info.duration });
      }
    }
    window.addEventListener("message", onMsg);

    /* 🔴 **والمصافحةُ تبدأ من عندنا لا من عنده** (D-726، بعد أوّل قياسٍ
       حيّ: الشريطُ غاب والمقطعُ يعمل): **كنتُ أرسل «أنا مستمع» بعد
       `onReady`** — **و`onReady` نفسُها لا تصل حتى نرسل «أنا مستمع».**
       🔑 **حلقةٌ مغلقةٌ طرفاها ينتظر كلٌّ منهما الآخر** — **ومن انتظر
       إشارةً لا تُرسل إلّا لمن أشار أوّلاً انتظر إلى الأبد.**
       **فالنداءُ يُكرَّر حتى يُجاب ثمّ يسكت** — ولا يبقى نبضٌ أبديّ. */
    let tries = 0;
    const hello = window.setInterval(() => {
      if (got || tries++ > 20) {
        window.clearInterval(hello);
        return;
      }
      try {
        frame.current?.contentWindow?.postMessage(
          JSON.stringify({ event: "listening", id: videoKey, channel: "widget" }),
          YT_ORIGIN,
        );
      } catch {
        /* الإطارُ لم يصل بعد — النبضةُ القادمة تحاول */
      }
    }, 400);

    /* ⚠️ **وحزامٌ زمنيٌّ خلف الإشارة** (D-729): **لو لم تصل حالةُ
       التشغيل أبداً لبقيت الصورةُ فوق مقطعٍ يعمل** — **وسترٌ دائمٌ
       أسوأُ من سترٍ متأخّر.** **ثلاثُ ثوانٍ سقفُ الانتظار**، وهي
       أطولُ من كلِّ تخزينٍ معقول. ⚠️ **وثمانٍ لا ثلاث** (بعد القياس):
       **الثلاثُ كانت تسبق التخزينَ على شبكةٍ بطيئة فتكشف إطاراً فارغاً**
       — **وحزامٌ يسبق الحدثَ الذي يحرسه ليس حزاماً، هو مؤقّتٌ يكذب.** */
    const belt = window.setTimeout(() => setPlaying(true), 8000);

    return () => {
      window.clearInterval(hello);
      window.clearTimeout(belt);
      window.removeEventListener("message", onMsg);
    };
  }, [mounted, videoKey, showProgress]);

  /* ===== ٤) الصمتُ حالةٌ يملكها القارئ لا الإطار ===== */
  useEffect(() => {
    if (!mounted) return;
    send(muted ? "mute" : "unMute");
  }, [muted, mounted, send]);

  const src =
    mounted && typeof window !== "undefined"
      ? `${YT_ORIGIN}/embed/${encodeURIComponent(videoKey)}?autoplay=1&mute=1&playsinline=1&controls=0&rel=0&modestbranding=1&loop=0&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`
      : null;

  const pct = at && at.total > 0 ? Math.min(100, (at.now / at.total) * 100) : 0;

  return (
    <div ref={box} className={`relative overflow-hidden bg-surface-2 ${className}`}>
      {src && (
        <iframe
          ref={frame}
          src={src}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture"
          className="absolute inset-0 w-full h-full"
          /* **ولا تفاعلَ مع الإطار**: الضغطُ يفتح يوتيوب ويكسر التمرير —
             **والأزرارُ التي نملكها فوقَه** (D-030: لا بابَ لا نتحكّم به). */
          style={{ pointerEvents: "none", border: 0 }}
        />
      )}

      {/* **الصورةُ تبقى حتى يقول الإطارُ إنه يرسم** — لا سوادَ بينهما */}
      {backdrop && (
        <Image
          src={backdrop}
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 720px"
          className={`object-cover transition-opacity duration-500 ${playing ? "opacity-0" : "opacity-100"}`}
          priority={false}
        />
      )}

      {/* **البابُ تحت الأزرار وفوق الصورة** — انظر حجّةَ `href` أعلاه */}
      {href && (
        <Link href={href} prefetch={false} aria-label={openLabel ?? title} className="absolute inset-0 z-[5]" />
      )}

      {/* **زرُّ التشغيل يظهر حين لا تشغيلَ تلقائيّ** (توفيرُ البيانات أو
          بيئةٌ بلا مراقب) — **صورةٌ وزرٌّ لا رسالةُ عطل.** */}
      {held && !mounted && (
        <button
          type="button"
          onClick={() => {
            claim(stop);
            setMounted(true);
            setPlaying(true);
          }}
          aria-label={playLabel}
          className="absolute inset-0 z-10 grid place-items-center"
        >
          <span className="w-14 h-14 rounded-full bg-accent text-[color:var(--on-accent)] grid place-items-center shadow-lg">
            <Icon name="play" size={26} />
          </span>
        </button>
      )}

      {/* **مفتاحُ الصوت** — الفعلُ لا الحالة (D-224): ما سيقع عند الضغط */}
      <button
        type="button"
        onClick={() => onMutedChange(!muted)}
        aria-label={muted ? unmuteLabel : muteLabel}
        className="absolute top-2.5 end-2.5 z-10 w-9 h-9 rounded-full bg-black/55 text-white grid place-items-center backdrop-blur-sm active:opacity-70 transition"
      >
        <Icon name={muted ? "volume-off" : "volume"} size={17} />
      </button>

      {/* **وشريطُ التقدّم يغيب حين لا رقمَ يُقال** (D-222/D-217) */}
      {showProgress && at && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-3 pb-2.5 pt-6 bg-gradient-to-t from-black/70 to-transparent">
          <span dir="ltr" className="block text-12 text-white/90 tabular-nums mb-1.5">
            {clock(at.now)} / {clock(at.total)}
          </span>
          <span className="block h-[3px] rounded-full bg-white/25 overflow-hidden">
            <span
              className="block h-full bg-accent transition-[width] duration-500 ease-linear"
              style={{ width: `${pct}%` }}
            />
          </span>
        </div>
      )}
    </div>
  );
}
