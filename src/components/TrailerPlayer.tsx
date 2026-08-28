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
  videoKeys,
  eager = false,
  backdrop,
  title,
  muted,
  onMutedChange,
  playLabel,
  muteLabel,
  unmuteLabel,
  seekLabel,
  className = "",
  showProgress = true,
  href,
  openLabel,
}: {
  videoKey: string;
  /**
   * 🆕 **بدائلُ المقطع** (D-743): **حين يرفض يوتيوب الأوّل — حجباً
   * بلديّاً أو تعطيلَ تضمين — يُجرَّب الذي يليه.** **والغيابُ يعني
   * مقطعاً واحداً**، فلا كسرَ لمن لا يمرّرها.
   */
  videoKeys?: string[];
  /**
   * 🆕 **أوّلُ بطاقةٍ فوق الطيّة لا تنتظر فراغَ المتصفّح** (D-743):
   * **`requestIdleCallback` تؤجّل ما هو مرئيٌّ الآن** — **والتأجيلُ
   * لمن يُرى تأخيرٌ لا اقتصاد.**
   */
  eager?: boolean;
  backdrop: string | null;
  title: string;
  muted: boolean;
  onMutedChange: (next: boolean) => void;
  playLabel: string;
  muteLabel: string;
  unmuteLabel: string;
  /** 🆕 **اسمُ شريطِ التقدّم لقارئ الشاشة** (D-741) */
  seekLabel?: string;
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
  /**
   * 🆕 **أيُّ البدائل نعرض الآن** (D-743) — **يتقدّم عند رفضِ يوتيوب،
   * ولا يرجع**: **مقطعٌ رُفض مرّةً يُرفض ثانيةً، والدورانُ عليه حلقة.**
   */
  const [tryIdx, setTryIdx] = useState(0);
  /**
   * 🆕 **وقوفٌ معلومٌ لا انتظارُ تحميل** (D-743): **الصورةُ تنزل في
   * الحالين، والفرقُ أنّ الواقفَ يستحقّ علامةَ «اضغطني» والمحمَّلَ لا**
   * — **ومثلّثٌ فوق مقطعٍ يوشك أن يبدأ يومض ثمّ يختفي، وهو ضجيج.**
   */
  const [paused, setPaused] = useState(false);
  const keys = videoKeys?.length ? videoKeys : [videoKey];
  const key = keys[Math.min(tryIdx, keys.length - 1)];
  /** **ونفدت البدائل**: الصورةُ وحدَها — **ولا رسالةَ عطلٍ في صفٍّ يُمرَّر** */
  const dead = tryIdx >= keys.length;
  /**
   * 🔑 **قيمةُ الصمت في مرجعٍ لا في تبعيّة** (D-730): **مستمعُ الرسائل
   * يُعاد تركيبُه كلّما تغيّرت تبعيّاتُه** — **وإعادةُ تركيبه تقطع
   * المصافحةَ مع الإطار** (D-726). **فالمرجعُ يقرأ الأحدثَ بلا أن
   * يُحرّك المستمع.**
   */
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  /** **ومسطرةُ الوقت مرجعٌ كذلك** — لنفس سبب `mutedRef` فوق */
  const atRef = useRef(at);
  atRef.current = at;
  const bar = useRef<HTMLDivElement>(null);

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

  /**
   * 🆕 **الانتقالُ في المقطع** (D-741، بلاغُ أحمد بلقطةٍ محوَّطة: «ما
   * أقدر أقدّم الفيديو»).
   *
   * 🔑 **وشريطٌ يُرسم ولا يُضغط يَعِد بما لا يفي**: **كلُّ من رأى شريطَ
   * تقدّمٍ في عمره ضغطه** — **فرسمُه وحدَه دعوةٌ**، وهي D-198 من جهتها
   * الثانية («ما لا بابَ له يقول إن ما تراه هو كلُّ ما هناك»).
   * ⚠️ **ولا بايتَ من جافاسكربت يوتيوب** (شرطُ D-726): `seekTo` أمرٌ
   * في `postMessage` كأخواته، **والثمنُ صفر.**
   * ⚠️ **والرقمُ يُقفز في الحال ولا يُنتظر ردُّ الإطار**: **`infoDelivery`
   * تصل كلَّ ربعِ ثانيةٍ تقريباً** — **وشريطٌ يتأخّر ربعَ ثانيةٍ عن
   * إصبعِك يُقرأ عطلاً لا بطئاً.**
   */
  const seek = useCallback(
    (clientX: number) => {
      const el = bar.current;
      const total = atRef.current?.total ?? 0;
      if (!el || total <= 0) return;
      const r = el.getBoundingClientRect();
      if (r.width <= 0) return;
      const frac = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
      const to = frac * total;
      send("seekTo", [to, true]);
      setAt((p) => (p ? { ...p, now: to } : p));
    },
    [send],
  );

  const nudge = useCallback(
    (by: number) => {
      const a2 = atRef.current;
      if (!a2 || a2.total <= 0) return;
      const to = Math.min(a2.total, Math.max(0, a2.now + by));
      send("seekTo", [to, true]);
      setAt((p) => (p ? { ...p, now: to } : p));
    },
    [send],
  );

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
        /* 🔴 🆕 **حدُّ التشغيل غيرُ حدِّ الإيقاف** (D-743، بلاغُ أحمد:
           «الفيديو ما يشتغل بسرعة، ويتوقّف من نفسه»).
           🔑 **كان الحدُّ واحداً (٠٫٦)** — **فأيُّ تمريرةٍ صغيرةٍ تُنزل
           البطاقةَ تحته توقف المقطع**، **ورجوعُها فوقه يُعيد التحميلَ
           من الصفر** (لأن الخروجَ التامَّ يفكّك). **فالعرَضان اللذان
           اشتكى منهما سببُهما رقمٌ واحد.**
           🔑 **والقاعدة**: **حدٌّ واحدٌ لفعلٍ وضدِّه يجعل الحافّةَ
           مفتاحاً يرتجف** — **ومن أراد سكوناً فليُبعد حدَّ الرجوع عن
           حدَّ الذهاب.** (تخلّفٌ حراريٌّ: يشتغل عند ٠٫٤ ويصمت تحت
           ٠٫١٥.)
           ⚠️ **وأربعون بالمئة لا ستّون لبدء التحميل**: **يوتيوب يحتاج
           ثوانيَ قبل أوّل إطار** — **والبدءُ حين تصير البطاقةُ مرئيّةً
           بالكامل بدءٌ متأخّرٌ بثوانٍ يراها القارئُ بطئاً.** */
        if (e.isIntersecting && e.intersectionRatio >= 0.4) {
          claim(stop);
          cancelIdle?.();
          /* **وأوّلُ بطاقةٍ لا تنتظر فراغاً**: `idle` تؤجّل ما هو
             مرئيٌّ الآن — **والتأجيلُ لمن يُرى تأخيرٌ لا اقتصاد.** */
          if (eager) {
            setMounted(true);
            send("playVideo");
          } else {
            cancelIdle = idle(() => {
              setMounted(true);
              send("playVideo");
            });
          }
        } else if (e.intersectionRatio < 0.15) {
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
      { threshold: [0, 0.15, 0.4, 1] },
    );
    io.observe(el);
    return () => {
      cancelIdle?.();
      io.disconnect();
      release(stop);
    };
  }, [send, stop, eager]);

  /* ===== ٢) التطبيقُ يذهب للخلفيّة فيصمت، ويعود فيستأنف ===== */
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "hidden") {
        stop();
        return;
      }
      /* 🆕 **والعودةُ تُعيد ما أخذَته الخلفيّة** (D-730): **صاحبُ الدور
         وحدَه يستأنف** — **ولو استأنف كلُّ مشغّلٍ لسمع القارئُ صوتين**
         (حارسُ الواحديّة، D-726).
         ⚠️ **والصوتُ يُعاد تأكيدُه لا يُفترض بقاؤه**: **النظامُ قد
         يُسكت الإطارَ وهو في الخلفيّة** — **وتفضيلٌ محفوظٌ لا يُنفَّذ
         تفضيلٌ لم يُطبَّق.** */
      if (CURRENT !== stop) return;
      send(mutedRef.current ? "mute" : "unMute");
      send("playVideo");
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pagehide", stop);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pagehide", stop);
    };
  }, [stop, send]);

  /* ===== ٣) ما يعود من الإطار: أوّلُ رسمٍ وشريطُ التقدّم ===== */
  useEffect(() => {
    if (!mounted) return;
    /** **ويسكت النداءُ عند أوّل جواب** — لا نبضَ بلا حاجة */
    let got = false;
    /** **وتأكيدُ الصوت مرّةً واحدةً عند أوّل جوابٍ من الإطار** (D-730) */
    let heard = false;
    function onMsg(e: MessageEvent) {
      if (e.origin !== YT_ORIGIN) return;
      let d: {
        event?: string;
        info?: {
          currentTime?: number;
          duration?: number;
          playerState?: number;
          errorCode?: number;
        };
      };
      try {
        d = typeof e.data === "string" ? JSON.parse(e.data) : (e.data as typeof d);
      } catch {
        return;
      }
      /* 🔴 🆕 **ويوتيوب يقول «لا» فنسمعها** (D-743، بلاغُ أحمد بلقطة:
         «الفيديو يقول ما هو مسموح في دولتك»).
         🔑 **رفضُ الإطار ليس عطلاً عندنا بل خبرٌ منه**: `onError`
         تصل بأرقامٍ معروفة — **١٠٠ لا وجودَ له، و١٠١/١٥٠ صاحبُه منع
         التضمين أو حجبه عن بلدك.** **وثلاثتُها جوابُها واحد: جرّب
         الذي يليه.**
         ⚠️ **وتصل بشكلين**: `event:"onError"` وحدَها، **أو `errorCode`
         داخل `info`** — **ومن حرس شكلاً واحداً حرس نصفَ الباب.**
         ⚠️ **ولا رسالةَ عطلٍ للقارئ حين تنفد البدائل**: **الصورةُ
         والتفاصيلُ تكفيان** — **وصفٌّ يُمرَّر ليس مكانَ اعتذار**
         (D-217: لا تقل ما لا ينفع). */
      const errored =
        d?.event === "onError" ||
        typeof d?.info?.errorCode === "number" ||
        (typeof d?.info === "number" && d?.event === "onError");
      if (errored) {
        setPlaying(false);
        setAt(null);
        setTryIdx((i) => i + 1);
        return;
      }
      const info = d?.info;
      if (!info) return;
      /* 🔴 **وأوّلُ جوابٍ من الإطار هو أوّلُ لحظةٍ يسمع فيها** (D-730،
         بلاغُ أحمد: «الصوت ما يشتغل إلّا بعد إيقافه ثمّ تشغيله»).
         🔑 **وأمرٌ يُرسَل إلى إطارٍ لم يُحمَّل بعدُ يضيع بلا خطأ**:
         كنّا نرسل `unMute` لحظةَ التركيب — **والإطارُ يومَها صفحةٌ لم
         تُفتح** — **فيبقى صامتاً وتفضيلُه يقول «مسموع».** **وتوقيفُه
         ثمّ تشغيلُه كان يُعيد إرسالَ الأمر فينجح**، وهو بالضبط ما وصفه.
         🔑 **فالحالةُ تُعاد عند أوّل دليلٍ على السمع لا عند أوّل ظنٍّ
         بالجاهزيّة.**
         ⚠️ **وموضعُه هنا لا داخل فرع شريط التقدّم**: **تأكيدُ الصوت
         لا يجوز أن يتعلّق بعَلَمٍ يخصّ شيئاً آخر** — **ومن علّق ضرورةً
         بشرطِ زينةٍ أسقطها يومَ تُطفأ الزينة.** */
      if (!heard) {
        heard = true;
        send(mutedRef.current ? "mute" : "unMute");
      }
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
        setPaused(false);
      }
      /* 🔴 🆕 **ووجهُ يوتيوب لا يكون وجهَ بطاقتنا** (D-743، لقطتُه
         الأولى: زرٌّ أحمرُ و«Watch on YouTube» فوق المقطع).
         🔑 **`controls=0` يخفي الأزرار ولا يخفي لوحةَ التوقّف**:
         **ما إن يتوقّف المقطعُ — بأمرنا أو بأمرِ يوتيوب — حتى يرسم
         علامتَه واسمَ رافعِه ودعوةً لمغادرة تطبيقنا.**
         🔑 **والعلاجُ أن تنزل صورتُنا فوقه في كلِّ توقّف**: **٢ موقوف
         و٠ انتهى و٥ مُهيَّأ و‎-١ لم يبدأ** — **أربعُ حالاتٍ معناها
         واحد: لا يرسم الآن، فلتنزل الصورة.**
         ⚠️ **و٣ (يُخزِّن) ليست منها**: **التخزينُ طريقٌ إلى الرسم لا
         توقّفٌ عنه** — **وإنزالُ الصورة عنده وميضٌ في كلِّ تلعثمِ
         شبكة.** */
      if (
        info.playerState === 2 ||
        info.playerState === 0 ||
        info.playerState === 5 ||
        info.playerState === -1
      ) {
        setPlaying(false);
        setPaused(info.playerState === 2 || info.playerState === 0);
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
          JSON.stringify({ event: "listening", id: key, channel: "widget" }),
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
  }, [mounted, key, showProgress]);

  /* ===== ٤) الصمتُ حالةٌ يملكها القارئ لا الإطار ===== */
  useEffect(() => {
    if (!mounted) return;
    send(muted ? "mute" : "unMute");
  }, [muted, mounted, send]);

  const src =
    mounted && !dead && typeof window !== "undefined"
      ? `${YT_ORIGIN}/embed/${encodeURIComponent(key)}?autoplay=1&mute=1&playsinline=1&controls=0&rel=0&modestbranding=1&loop=0&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`
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

      {/* **البابُ تحت الأزرار وفوق الصورة** — انظر حجّةَ `href` أعلاه.
          🔴 🆕 **ولا يُرسم على مقطعٍ واقف** (D-743، بلاغُ أحمد: «إذا
          ضغطتها ما يشتغل، يفتح لي التبويب»).
          🔑 **الضغطةُ على شيءٍ واقفٍ معناها «شغّله» لا «خذني لمكانٍ
          آخر»** — **وبابٌ شفّافٌ فوق زرِّ تشغيلٍ يسرق أوضحَ نيّةٍ في
          الواجهة.** **وهو عطلُ D-729 بعينه** (الغلافُ ابتلع مفتاحَ
          الصوت) **من بابٍ ثانٍ: هناك ابتلع زرَّنا، وهنا يبتلع نيّةَ
          القارئ.**
          ⚠️ **والتفاصيلُ لم تُفقد**: **زرُّ «التفاصيل» تحت البطاقة** —
          **ووجهتان لسطحٍ واحدٍ تُفرَّقان بالحال لا بالحظّ.** */}
      {href && playing && (
        <Link href={href} prefetch={false} aria-label={openLabel ?? title} className="absolute inset-0 z-[5]" />
      )}

      {/* 🆕 **وسطحُ المقطع الواقف زرُّ تشغيل** (D-743) — **ولا يُرسم مع
          `held`** فذاك له زرُّه المعلَن أدناه، **ولا فوق ميّتٍ نفدت
          بدائلُه** فلا شيءَ يُشغَّل. */}
      {!playing && !held && !dead && (
        <button
          type="button"
          onClick={() => {
            claim(stop);
            setMounted(true);
            setTryIdx((i) => (i >= keys.length ? 0 : i));
            send(mutedRef.current ? "mute" : "unMute");
            send("playVideo");
          }}
          aria-label={playLabel}
          className="absolute inset-0 z-[6] grid place-items-center"
        >
          {paused && (
            <span className="w-14 h-14 rounded-full bg-black/55 text-white grid place-items-center backdrop-blur-sm">
              <Icon name="play" size={26} />
            </span>
          )}
        </button>
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
          {/* 🆕 **ومساحةُ اللمس أعرضُ من الخطّ** (D-741): **ثلاثةُ
              بكسلاتٍ لا يصيبها إصبع** — **فالحشوةُ تُضاف ثمّ تُسحب
              بهامشٍ سالبٍ فلا يتحرّك الرسمُ شعرة.**
              🔴 **و`dir="ltr"` شرطٌ لا زينة**: **الزمنُ يجري يساراً
              يميناً في كلِّ مشغّلٍ في الدنيا**، والرقمُ فوقه `ltr` منذ
              كُتب — **وشريطٌ يمتلئ من اليمين تحت رقمٍ يعدّ من اليسار
              يجعل الضغطةَ اليسرى تقفز إلى النهاية.** **والعطلُ كان
              مستوراً ما دام الشريطُ لا يُضغط** (D-002: رمزان لمعنًى
              واحدٍ يفترقان عند أوّل تعديل). */}
          <div
            ref={bar}
            dir="ltr"
            role="slider"
            tabIndex={0}
            aria-label={seekLabel ?? title}
            aria-valuemin={0}
            aria-valuemax={Math.round(at.total)}
            aria-valuenow={Math.round(at.now)}
            aria-valuetext={`${clock(at.now)} / ${clock(at.total)}`}
            className="pointer-events-auto -my-2 py-2 cursor-pointer touch-none"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.currentTarget.setPointerCapture(e.pointerId);
              seek(e.clientX);
            }}
            onPointerMove={(e) => {
              if (e.currentTarget.hasPointerCapture(e.pointerId)) seek(e.clientX);
            }}
            onKeyDown={(e) => {
              /* **والسهمُ يتبع الزمنَ لا الاتّجاه**: يمينٌ يقدّم في
                 العربيّة كما في الإنجليزيّة — **الشريطُ `ltr`.** */
              if (e.key === "ArrowRight") { e.preventDefault(); nudge(5); }
              else if (e.key === "ArrowLeft") { e.preventDefault(); nudge(-5); }
            }}
          >
            <span className="block h-[3px] rounded-full bg-white/25 overflow-hidden">
              <span
                className="block h-full bg-accent transition-[width] duration-500 ease-linear"
                style={{ width: `${pct}%` }}
              />
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
