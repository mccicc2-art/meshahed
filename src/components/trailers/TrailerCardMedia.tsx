"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../Icon";
import {
  clockText,
  TrailerScrubber,
  TrailerSpinner,
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
 * ⚖️ **أدواتُ التحكّم عادت بطلب صاحبها** (D-762) — سطحُ استئنافٍ وشريطُ
 * تقديمٍ وزرُّ تكبير.
 *
 * ⚖️ 🆕 **وفي الرايل صارت البطاقةُ مقطعاً لا نافذة** (D-861، حكمُ أحمد:
 * «يخفي شريط التقدم وكل شي ماعدا الصوت · وإذا ضغطت عليه تظهر · وحالياً
 * يفتح صفحة ترايلر ألغِها، والوصولُ من العنوان أو زرّ All فقط») —
 * **نقضٌ صريحٌ لنافذة D-743**: الضغطةُ على المقطع **تُظهر الأدوات ولا
 * تنقل**. 🔑 **والسببُ أن الوجهتين اجتمعتا على سطحٍ واحد**: من ضغط
 * ليكتم أو ليقدّم وجد نفسَه في صفحةٍ أخرى — **وبابُ الصفحة له نصُّه
 * وزرُّه، وهما لا يلتبسان بالفيديو.**
 */

export function TrailerCardMedia({
  id,
  item,
  backdrop,
  title,
  eager = false,
  playLabel,
  pauseLabel,
  muteLabel,
  unmuteLabel,
  withControls = false,
  seekLabel,
  expandLabel,
  onUnavailable,
}: {
  id: string;
  item: TrailerSlotItem;
  backdrop: string | null;
  title: string;
  eager?: boolean;
  playLabel: string;
  /** 🆕 D-878: اسمُ فعل الإيقاف — **اختياريٌّ حتى يصل من القارئَين** (D-028) */
  pauseLabel?: string;
  muteLabel: string;
  unmuteLabel: string;
  /** 🆕 D-762: أدواتُ التحكّم الكاملة — للعلف وحدَه، لا للرايل */
  withControls?: boolean;
  seekLabel?: string;
  expandLabel?: string;
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
  /* 🆕 D-762: الإيقافُ المؤقّتُ يُبقي الصورةَ (لا غلافَ فوق إطارٍ مرسوم)
     — وphase «paused» لا تقع إلا بعد «playing» فالإطارُ مضمونُ الرسم */
  const revealed = isActive && (snap.phase === "playing" || snap.phase === "paused");
  /* 🆕 D-764: الأزرارُ تتوارى بعد ٥ ثوانِ تشغيل — فئةُ التلاشي واحدة */
  const controls = snap.controlsVisible;
  /* 🆕 **وفي الرايل لا تظهر الأدواتُ إلا بلمسة** (D-861): المتحكّمُ يكشفها
     ثانيتين عند الإقلاع (D-764) — **وحكمُ أحمد أن تبدأ مخفيّةً تماماً.**
     🔑 **ولا مؤقّتَ ثانياً يُخترع**: التوقيتُ يبقى للمتحكّم وحدَه (ق٣)،
     وهذه رايةٌ محلّيّةٌ تقول «هل لمسها صاحبُها بعد؟» — تُرفع باللمسة
     وتسقط مع أوّل إخفاءٍ يقرّره المتحكّم. */
  const [poked, setPoked] = useState(false);
  /* ⚠️ **وإسقاطُ الراية اشتقاقٌ أثناء الرسم لا أثرٌ جانبيّ**: نمطُ React
     الرسميّ لتصفير حالةٍ تتبع قيمةً خارجيّة — **و`useEffect` هنا كان
     يرسم مرّتين ويخالف قاعدةَ الخطّافات.** */
  if (!controls && poked) setPoked(false);
  const chrome = withControls ? controls : controls && poked;
  const fade = `transition-opacity duration-300 ${chrome ? "opacity-100" : "pointer-events-none opacity-0"}`;
  const showsPlayButton =
    (isActive && (snap.phase === "paused" || snap.phase === "blocked" || snap.phase === "stalled")) ||
    (!playing && snap.manualOnly);

  /* 🆕 D-878 (حكمُ أحمد بلقطةٍ على بطاقة الرايل، دائرتان على طرفَي المقطع:
     «أريد استطاعة إيقافه وتشغيله، وتحريك الشريط السفلي، وإذا عملت هولد
     يمين أو يسار يسرّع الفيديو») — ⚖️ **نقضٌ لـD-771 بيد صاحبه.**

     **الإيقاف**: اللمسةُ الأولى تكشف الأدوات (D-764 كما كان)، **واللمسةُ
     والأدواتُ مكشوفةٌ توقف** — **وأيقونةُ ⏸ في الوسط تقول ذلك قبل أن
     تقع** (D-217: لا فعلَ خفيّاً). والواقفةُ زرُّ ▶ كما كان.

     **الضغطةُ المطوّلة**: ٣٥٠ مللي ثانية بلا حركة — **النصفُ الأيمن ٢×**
     (`setPlaybackRate` الرسمية)، **والنصفُ الأيسر ترجيعٌ**: يوتيوب لا
     يعرف سرعةً سالبة، **فيُقفَز ثانيتين إلى الوراء كلَّ ربع ثانية** (~٨×
     محسوسة). **ورفعُ الإصبع يعيد كلَّ شيء**، **والضغطةُ التي كانت
     هولداً لا تُحسب لمسة** (`heldRef`) فلا يُوقَف المقطعُ عند الرفع.
     ⚠️ **ولا `touch-action: none` على السطح**: **البطاقةُ في صفحةٍ تُمرَّر**،
     والتمريرُ يُلغي الضغطةَ بنفسه (`pointercancel`) — **فمن سحب مرّ، ومن
     ثبّت إصبعَه سرّع.** */
  const holdTimer = useRef<number | null>(null);
  const rewindTimer = useRef<number | null>(null);
  const heldRef = useRef(false);
  const downX = useRef<number | null>(null);
  const [hold, setHold] = useState<"ff" | "rw" | null>(null);
  /* **الزمنُ للترجيع يُقرأ من المتحكّم لا من مرجعٍ يُكتب أثناء الرسم**
     (قاعدةُ React: لا مرجعَ يُمسّ في الرسم) — `getSnapshot` هي المصدرُ نفسُه */
  const readNow = () => api.getSnapshot().time;

  const endHold = () => {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (rewindTimer.current !== null) {
      window.clearInterval(rewindTimer.current);
      rewindTimer.current = null;
    }
    /* **السرعةُ تُعاد كلَّما كان هولدٌ** — من المرجع لا من الحالة، فلا
       تُفلت ضغطةٌ رُفعت قبل أن يُعاد الرسم */
    if (heldRef.current) api.setRate(1);
    setHold(null);
    downX.current = null;
  };
  useEffect(() => {
    const timers = { holdTimer, rewindTimer };
    return () => {
      if (timers.holdTimer.current !== null) window.clearTimeout(timers.holdTimer.current);
      if (timers.rewindTimer.current !== null) window.clearInterval(timers.rewindTimer.current);
    };
  }, []);

  const beginHold = (side: "ff" | "rw") => {
    heldRef.current = true;
    setHold(side);
    api.pokeControls();
    if (side === "ff") api.setRate(2);
    else {
      rewindTimer.current = window.setInterval(() => {
        const t = readNow();
        if (t) api.seekTo(Math.max(0, t.now - 2));
      }, 250);
    }
  };

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
            revealed ? "invisible opacity-0" : "visible opacity-100"
          }`}
          priority={eager}
          fetchPriority={eager ? "high" : "auto"}
        />
      ) : null}

      {/* 🗑️ ⚖️ **وسقط بابُ الصفحة من فوق المقطع** (D-861 — نقضُ D-743
          بحكم صاحبه): كان رابطاً يغطّي المساحة كلَّها حين تعمل،
          **فالضغطةُ تنقل ولا تكشف** — **وسطحٌ واحدٌ لوجهتين يُقرأ
          خطأً** (ق٦). **والوجهةُ باقيةٌ في نصِّ العنوان وزرِّ All.** */}
      {/* ⚖️ 🆕 D-771 (حكمه: «تلغي خيار إيقاف الفديو خله دائماً شغال» —
          نقضٌ صريحٌ منه لسطحِ الإيقاف الذي طلبه في D-762): لمسةُ السطح
          في العلف تُظهر الأزرارَ فقط ولا توقف أبداً — والي فاته شيءٌ
          يرجع بشريط التقديم. وفي الرايل كما كان: زرُّ تشغيلٍ للواقفة،
          ونافذةُ D-743 للعاملة. */}
      {/* ⚖️ 🆕 **والسطحُ حاضرٌ دائماً** (D-861): كان يغيب في الرايل أثناء
          التشغيل لأن الرابطَ يعتليه — **وقد سقط الرابط، فاللمسةُ صارت
          له**: تكشف الأدواتِ إن كان يعمل، وتُشغّل إن كان واقفاً. */}
      {true ? (
        <button
          type="button"
          onClick={() => {
            /* **ضغطةٌ كانت هولداً لا تُحسب لمسة** (D-878) */
            if (heldRef.current) {
              heldRef.current = false;
              return;
            }
            if (playing) {
              /* D-878: **مكشوفةُ الأدوات تُوقف، ومخفيّتُها تكشف** */
              if (chrome) api.togglePlay();
              else {
                api.pokeControls();
                setPoked(true);
              }
            } else api.tapPlay(id);
          }}
          onPointerDown={(e) => {
            if (!playing || e.button !== 0) return;
            heldRef.current = false;
            downX.current = e.clientX;
            const r = e.currentTarget.getBoundingClientRect();
            const side: "ff" | "rw" = e.clientX - r.left > r.width / 2 ? "ff" : "rw";
            holdTimer.current = window.setTimeout(() => {
              holdTimer.current = null;
              beginHold(side);
            }, 350);
          }}
          onPointerMove={(e) => {
            /* **حركةٌ قبل أن يشتدّ الهولد = تمريرٌ لا ضغطة** */
            if (holdTimer.current !== null && downX.current !== null && Math.abs(e.clientX - downX.current) > 10)
              endHold();
          }}
          onPointerUp={endHold}
          onPointerCancel={endHold}
          onPointerLeave={endHold}
          onContextMenu={(e) => {
            if (playing) e.preventDefault();
          }}
          /* ⚠️ 🆕 **والسطحُ يُعلَن لقارئ الشاشة حين يعمل أيضاً** (D-861):
             **صار هو بابَ كشفِ الأدوات** — **وإخفاؤه كما كان يترك
             مستعملَ لوحةِ المفاتيح بلا وصولٍ إلى الصوت والتقديم.**
             واسمُه اسمُ العمل حينئذٍ لا كلمة «تشغيل» التي تكذب. */
          aria-label={showsPlayButton ? playLabel : playing && chrome ? (pauseLabel ?? title) : title}
          aria-hidden={!showsPlayButton && !playing}
          tabIndex={showsPlayButton || playing ? 0 : -1}
          className="absolute inset-0 z-50 grid select-none place-items-center"
          style={{ WebkitTouchCallout: "none" }}
        >
          {showsPlayButton ? (
            <span className="grid h-14 w-14 place-items-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-sm">
              <Icon name="play" size={26} />
            </span>
          ) : playing && chrome && !hold ? (
            /* D-878: **⏸ في الوسط ما دامت الأدواتُ مكشوفة** — يتوارى معها */
            <span
              className={`grid h-14 w-14 place-items-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-sm ${fade}`}
            >
              <Icon name="pause" size={26} />
            </span>
          ) : null}
          {hold ? (
            /* D-878: **شارةُ الهولد على طرفها** — ٢× يميناً وترجيعٌ يساراً */
            <span
              dir="ltr"
              className={`absolute top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-3 py-1.5 text-13 font-bold tabular-nums text-white backdrop-blur-sm ${
                hold === "ff" ? "right-4" : "left-4"
              }`}
            >
              {hold === "ff" ? "2× ▸▸" : "◂◂"}
            </span>
          ) : null}
        </button>
      ) : null}

      {/* 🆕 D-762: التكبيرُ المسرحيّ — للعلف وحدَه، وعلى بطاقةٍ مكشوفة */}
      {withControls && expandLabel && revealed ? (
        <button
          type="button"
          onClick={() => api.toggleExpand()}
          aria-label={expandLabel}
          className={`absolute start-2.5 top-2.5 z-50 grid h-9 w-9 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm active:opacity-70 ${fade}`}
        >
          <Icon name="expand" size={17} />
        </button>
      ) : null}

      {/* 🆕 D-764: مؤشّرُ تحميلٍ دائريٌّ أثناء «loading» — «مايحسبه معلّق» */}
      <TrailerSpinner active={isActive && snap.phase === "loading"} />

      {/* 🔴 زرُّ الصوت — **لبطاقةٍ تعمل فعلاً وحدَها**: على iPhone كان
          يظهر أثناء الحظر فصار هو زرَّ التشغيل الفعليّ. الأيقونةُ من
          الحالة المُتحقَّقة، والتشغيلُ لزرِّ التشغيل وحدَه. */}
      {playing ? (
        <button
          type="button"
          onClick={() => api.tapSound()}
          aria-label={snap.soundOn ? muteLabel : unmuteLabel}
          /* ⚖️ 🆕 **والصوتُ وحدَه لا يتوارى** (D-861، نصُّ حكمه: «كل شي
             ماعدا الصوت») — **وهو الفعلُ الوحيدُ الذي يُطلب بلا مقدّمة**:
             مقطعٌ يبدأ صامتاً وصاحبُه يريد سماعَه **لا ينتظر لمستين.** */
          className="absolute end-2.5 top-2.5 z-50 grid h-9 w-9 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm active:opacity-70"
        >
          <Icon name={snap.soundOn ? "volume" : "volume-off"} size={17} />
        </button>
      ) : null}

      {/* ⚖️ D-762: في العلف شريطُ تقديمٍ فوق الوقت (عاد بطلب صاحبه) —
          وفي الرايل الوقتُ نصٌّ للقراءة كما كان */}
      {isActive && snap.time ? (
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-0 z-50 bg-gradient-to-t from-black/70 to-transparent px-3 pb-1.5 pt-6 ${fade}`}
        >
          {/* D-878: **الشريطُ حيث يُمرَّر اسمُه** — الرايلُ صار يمرّره أيضاً */}
          {seekLabel ? (
            <TrailerScrubber
              time={snap.time}
              onSeek={api.seekTo}
              label={seekLabel}
              active={controls}
            />
          ) : null}
          <span dir="ltr" className="block text-12 tabular-nums text-white/90">
            {clockText(snap.time.now)} / {clockText(snap.time.total)}
          </span>
        </div>
      ) : null}
    </div>
  );
}
