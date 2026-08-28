"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import { writeTrailerSound } from "@/lib/trailerPrefs";
import { providerOf } from "@/lib/trailerProviders";

/**
 * 🔴 🆕 **TrailerPlaybackController** (D-759 — إعادةُ بناءٍ من الأساس
 * بمواصفة أحمد المكتوبة، لا ترقيعُ المشغّل السابق).
 *
 * **القرارات الحاكمة، من نصِّ المواصفة:**
 * - **متحكّمٌ واحدٌ على مستوى السطح، ومشغّلٌ واحدٌ في DOM** — البطاقاتُ
 *   كلُّها صورٌ وأزرار، **ولا iframe لكلِّ بطاقة ولا ثلاثةٌ حول القارئ.**
 *   هذا يقتل صنفَ «تداخل المقاطع» من جذره.
 * - **واجهةُ يوتيوب الرسمية وحدَها** (`iframe_api` + `YT.Player` وأحداثُ
 *   `onReady/onStateChange/onError/onAutoplayBlocked`) — ⚖️ **نقضٌ مسجَّلٌ
 *   بأمر صاحبه لقرار D-726** («صفر بايت من جافاسكربت يوتيوب»):
 *   **البروتوكولُ اليدويُّ غيرُ الموثَّق هو أصلُ أعطال الصوت والعدّاد**،
 *   وثمنُ الواجهة الرسمية يُدفع مرّةً في الجلسة لأن المشغّلَ واحد.
 * - **العدّادُ من `getCurrentTime()/getDuration()` في interval واحد** —
 *   لا `infoDelivery` ولا رسائلَ يدويّة.
 * - **الصوتُ حقيقةٌ تُقرأ لا رغبةٌ تُعلن**: الأيقونةُ والكوكي لا يتغيّران
 *   إلّا بعد `isMuted() === false && getVolume() > 0`.
 * - **زرُّ التقديم محذوفٌ في هذه المرحلة** — ⚖️ نقضٌ مؤقّتٌ لـD-741
 *   بأمر صاحبه؛ يعود في مرحلةٍ مستقلّةٍ عبر `seekTo` الرسمية.
 * - **الانتقالُ بين البطاقات `loadVideoById`** — الإطارُ لا يُعاد إنشاؤه
 *   ولا يُنقل في DOM (**نقلُ iframe في DOM يعيد تحميلَه — قانونُ متصفّح
 *   لا خيار**)، فالمشغّلُ طبقةٌ ثابتةٌ تُحاذى فوق البطاقة النشطة.
 *
 * **الطبقة (overlay):** `position:fixed` تُحاذى بمزامنة rAF على مستطيل
 * مساحةِ الفيديو للبطاقة النشطة، **و`pointer-events:none` كاملةً** —
 * فاللمسُ كلُّه يصل البطاقةَ تحتها (المواصفة ١١/٦: الإطارُ لا يبتلع
 * التمرير)، والأزرارُ والوقتُ تبقى في البطاقات نفسِها فوقَها بالترتيب.
 * **وتظهر (`opacity`) فقط حين يثبت الرسمُ** (`PLAYING` و`t > 0.1`) —
 * فلا شاشةَ سوداءَ في أيِّ حال: الغلافُ يبقى حتى أوّلِ إطارٍ متحرّك.
 *
 * ⚠️ **والمحرّكُ كائنٌ أمريٌّ خارج قواعد الخطّافات عمداً**: تشغيلُ
 * الفيديو آلةُ حالاتٍ متبادلةُ النداءات — **وحشرُها في شبكة `useCallback`
 * يصنع دوراتِ «استُعمل قبل تعريفه» التي يمنعها مترجمُ React بحقّ.**
 * المكوّنُ قشرةٌ: DOM ومخزنُ لقطةٍ وتمريرُ أوامر.
 */

/* ===== أنواعُ واجهة يوتيوب الرسمية — الحدُّ الأدنى الذي نستعمله ===== */

interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  setVolume(volume: number): void;
  getVolume(): number;
  getCurrentTime(): number;
  getDuration(): number;
  loadVideoById(videoId: string): void;
  destroy(): void;
}

interface YTNamespace {
  Player: new (
    element: HTMLElement,
    config: {
      videoId?: string;
      host?: string;
      width?: string | number;
      height?: string | number;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: () => void;
        onStateChange?: (event: { data: number }) => void;
        onError?: (event: { data: number }) => void;
        onAutoplayBlocked?: () => void;
      };
    },
  ) => YTPlayer;
  PlayerState: {
    UNSTARTED: number;
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
    CUED: number;
  };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;

/** تحميلُ `iframe_api` مرّةً واحدةً للجلسة — والمصدرُ مثبَّتٌ في CSP */
function loadYouTubeApi(): Promise<YTNamespace> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (window.YT) resolve(window.YT);
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    document.head.appendChild(s);
  });
  return apiPromise;
}

/* ===== الحالةُ كما تراها البطاقات ===== */

export type SlotPhase = "idle" | "loading" | "playing" | "paused" | "blocked" | "stalled";

export interface TrailerSlotItem {
  keys: string[];
  fileUrl: string | null;
  title: string;
}

export interface ControllerSnapshot {
  activeId: string | null;
  phase: SlotPhase;
  /** **الصوتُ الفعليُّ المُتحقَّق** من المشغّل — لا الرغبة (المواصفة خامسًا) */
  soundOn: boolean;
  time: { now: number; total: number } | null;
  /** موفّرُ البيانات/2G — لا تشغيلَ آليّاً، زرٌّ في كلِّ بطاقة */
  manualOnly: boolean;
}

interface ControllerApi {
  register(id: string, area: HTMLElement, item: TrailerSlotItem): () => void;
  registerUnavailable(id: string, cb: () => void): void;
  tapPlay(id: string): void;
  tapSound(): void;
  subscribe(cb: () => void): () => void;
  getSnapshot(): ControllerSnapshot;
}

const Ctx = createContext<ControllerApi | null>(null);

export function useTrailerPlayback(): ControllerApi {
  const api = useContext(Ctx);
  if (!api) throw new Error("TrailerPlayback outside its provider");
  return api;
}

/** لقطةُ الحالة للبطاقات — اشتراكٌ خارجيٌّ فلا يُرسم أحدٌ عبثاً */
export function useTrailerSnapshot(): ControllerSnapshot {
  const api = useTrailerPlayback();
  return useSyncExternalStore(api.subscribe, api.getSnapshot, api.getSnapshot);
}

/* ===== عتباتُ الاختيار (المواصفة ثالثًا) ===== */

/** نشطةٌ عند ٦٠٪ — ⚖️ نقضٌ بأمر صاحبه لعتبة ٠٫٤ (D-743/D-756) */
const START_RATIO = 0.6;
/** وتتوقّف تحت ١٥٪ — hysteresis يمنع ارتجاف الحافّة */
const STOP_RATIO = 0.15;
/** والمنافسُ لا يخطف الدورَ إلّا أوضحَ بفارقٍ معتبر */
const SWITCH_GAP = 0.1;
/** ٨ ثوانٍ بلا إطارٍ متحرّك = زرُّ تشغيلٍ فوق الغلاف — لا إيقافَ ولا هدم */
const STALL_MS = 8000;
/** دورةُ العدّاد — من القيم الرسمية وحدَها (المواصفة سادسًا) */
const TICK_MS = 300;

function isSavingData(): boolean {
  try {
    const c = (
      navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }
    ).connection;
    return Boolean(c?.saveData) || Boolean(c?.effectiveType?.includes("2g"));
  } catch {
    return false;
  }
}

/** حارسُ «متحكّمٌ واحدٌ حيّ» — اثنان معاً خطأُ تركيبٍ يُصاح به */
let LIVE_CONTROLLERS = 0;

/* ===== المحرّك ===== */

interface EngineDom {
  overlay: HTMLDivElement;
  ytHost: HTMLDivElement;
  video: HTMLVideoElement;
}

function createEngine(
  dom: EngineDom,
  publish: (patch: Partial<ControllerSnapshot>) => void,
  readSnap: () => ControllerSnapshot,
  getSoundPref: () => boolean,
) {
  const slots = new Map<string, { area: HTMLElement; item: TrailerSlotItem }>();
  const ratios = new Map<string, number>();
  const unavailableCb = new Map<string, () => void>();
  /** بطاقةٌ نفدت بدائلُها لا يُعاد تنشيطُها أبداً — وإلا دارت حلقةُ
      خطأ→مصالحة→تنشيط إلى الأبد (قِيست في المختبر قبل هذا السطر) */
  const exhausted = new Set<string>();

  let io: IntersectionObserver | null = null;
  /* 🆕 D-761 (بأمر أحمد: «نفّذ» — ⚖️ نقضٌ صريحٌ منه لبند «iframe واحدٌ
     في DOM» من مواصفته، بعد أن عُرض عليه الثمن: إطارٌ ثانٍ ومضاعفةُ
     بيانات التحميل المسبق): **مشغّلان يتناوبان** — الظاهرُ يعمل فوق
     البطاقة النشطة، والخفيُّ يسبق بتحميل البطاقة المتوقَّعة (التالية في
     ترتيب السطح) صامتاً محجوباً ثم يقف على أوّل PLAYING؛ فالتبديلُ
     **ترقيةُ أدوارٍ** لا تحميلٌ من الصفر. حدودُ الانضباط: لا تحميلَ
     مسبقاً مع Save-Data/2G ولا والصفحةُ مخفيّة، واحتياطٌ واحدٌ لمفتاحٍ
     واحدٍ هو التالي مباشرةً، والخفيُّ لا يُسمَع ولا يُرى أبداً. */
  interface PlayerRec {
    p: YTPlayer | null;
    ready: boolean;
    frame: HTMLIFrameElement;
    /** المفتاحُ المحمَّلُ في هذا المشغّل الآن */
    key: string | null;
    /** حالُ التحميل المسبق حين يكون احتياطاً */
    preload: "idle" | "loading" | "ready";
    /** مفتاحٌ فشل تحميلُه المسبق — لا يُعاد بلا نهاية */
    failedKey: string | null;
  }
  let act: PlayerRec | null = null;
  let sby: PlayerRec | null = null;
  let tick: number | null = null;
  let stall: number | null = null;
  let raf: number | null = null;
  let activeId: string | null = null;
  let phase: SlotPhase = "idle";
  let keyIdx = 0;
  let advancedFor = -1;
  /** 🆕 D-760 (بلاغ أحمد: «كل فيديو لازم أضغط زرّ الصوت»): نيّةُ الصوت
      تُحمَل عبر البطاقات. `wantSound` آخرُ اختيارٍ صريح (بذرتُه الكوكي)،
      و`unlocked` هل فُكّ قفلُ WebKit الصوتيُّ **لهذا العنصر** بإيماءةٍ
      ناجحةٍ متحقَّقة — فبعد أوّل ضغطةِ صوتٍ تنطلق البطاقاتُ التاليةُ
      مصوَّتةً بلا ضغطةٍ لكلِّ فيديو. (أوّلُ فيديو بعد فتح الصفحة صامتٌ
      دائماً — قانونُ iOS لا خيارُنا.) */
  let wantSound = false;
  /** فُكّ قفلُ WebKit الصوتيُّ مرّةً في هذه الجلسة (تشغيلٌ مسموعٌ
      متحقَّق) — شرطُ حمل الصوت؛ ورفضٌ عارضٌ تعالجه مُعافاةُ PAUSED
      وcatch الملفّ بلا مسح العلم (D-761: العلمُ للجلسة لا للعنصر —
      المشغّلان يتناوبان والعنصرُ يتبدّل) */
  let soundSessionUnlocked = false;
  let verifyTimer: number | null = null;
  /** لحظةُ فكِّ كتمٍ آليٍّ (بلا إيماءة) — لكشف رفض WebKit والتعافي صامتاً */
  let autoUnmuteAt = 0;
  /** إيقافٌ أمرنا به نحن (تبديلٌ/خلفيّة) — صداه PAUSED ليس رفضَ WebKit:
      بدون هذا التمييز كان صدى إيقافِ السابقة يكتم اللاحقةَ المحمولةَ الصوت */
  let expectPause = false;
  let destroyed = false;

  const setPhase = (next: SlotPhase) => {
    phase = next;
    publish({ phase: next });
  };

  const activeSlot = () => (activeId ? (slots.get(activeId) ?? null) : null);
  const activeIsFile = () => {
    const s = activeSlot();
    return s ? providerOf(s.item) === "file" : false;
  };

  /* تصريحٌ متقدّمٌ كتصريح `reconcile` — الجسدُ أسفلَ حيث تسكن أدواتُه */
  let stopVeilProbe: () => void = () => undefined;

  /* ---- العدّاد: interval واحدٌ لا غير (المواصفة سادسًا/٧) ---- */
  const stopTick = () => {
    if (tick !== null) {
      window.clearInterval(tick);
      tick = null;
    }
    /* ومسبارُ السِّتر يسكن مع العدّاد أينما سكن */
    stopVeilProbe();
  };
  const clearStall = () => {
    if (stall !== null) {
      window.clearTimeout(stall);
      stall = null;
    }
  };

  /* 🔴 الإخفاءُ فوريٌّ ومتزامنٌ مع التبديل، والظهورُ متدرّج: تلاشي
     إخفاءٍ ٣٠٠م.ث كان يترك آخرَ إطارِ السابق يذوب فوق لحظةِ التبديل،
     وإرجاءُ الإخفاء إلى rAF التالي يترك نافذةَ إطارٍ يلتقطها القياس */
  let overlayShown = false;
  const showOverlay = (on: boolean) => {
    if (on === overlayShown) return;
    overlayShown = on;
    const el = dom.overlay;
    if (on) {
      el.style.transition = "opacity 300ms";
      el.style.opacity = "1";
    } else {
      el.style.transition = "none";
      el.style.opacity = "0";
    }
  };

  const readTime = (): { now: number; total: number } | null => {
    if (!activeId) return null;
    if (activeIsFile()) {
      const total = dom.video.duration;
      return Number.isFinite(total) && total > 0
        ? { now: dom.video.currentTime, total }
        : null;
    }
    if (!act?.p || !act.ready) return null;
    const total = act.p.getDuration();
    /* لا وقتَ يُعرض إلا بقيمٍ رسميةٍ منتهيةٍ موجبة (المواصفة سادسًا/٥) */
    return Number.isFinite(total) && total > 0 ? { now: act.p.getCurrentTime(), total } : null;
  };

  /* ---- الصوت: حقيقةٌ تُقرأ (المواصفة خامسًا) ---- */
  const verifySound = (): boolean => {
    let on = false;
    if (activeIsFile()) on = !dom.video.muted;
    else if (act?.p && act.ready) on = !act.p.isMuted() && act.p.getVolume() > 0;
    publish({ soundOn: on });
    return on;
  };

  /* 🔴 D-760، جذرُ «أطفيه وأشغّله»: `isMuted()` في واجهة يوتيوب قراءةٌ
     من ذاكرةِ الودجت المحلّية **ولا تتحدّث إلا برسالة الحالة التالية** —
     فقراءةٌ متزامنةٌ بعد أمرِ كتمٍ تعيد الحالةَ القديمة، فتَصدُق الأيقونةُ
     كذباً ويحتاج القارئُ ضغطتين. **فلا تحقُّقَ متزامناً بعد أمرٍ أبداً**:
     الأيقونةُ تُنشر بما أُمر به فوراً، والتحقّقُ يُجدوَل بعد الرحلة. */
  const scheduleVerify = (ms: number) => {
    if (verifyTimer !== null) window.clearTimeout(verifyTimer);
    verifyTimer = window.setTimeout(() => {
      verifyTimer = null;
      if (destroyed) return;
      const on = verifySound();
      if (on) {
        soundSessionUnlocked = true;
        autoUnmuteAt = 0;
      }
    }, ms);
  };

  /** نيّةُ الصوت داخل إيماءةٍ حقيقيّة (زرُّ التشغيل) — الضغطةُ الأولى
      تفكّ قفلَ WebKit، وبعدها تحمل البطاقاتُ التاليةُ الصوتَ بأنفسها.
      لا يدخل مسارَ التشغيل التلقائيّ الأوّل إطلاقاً. */
  const applySoundInGesture = () => {
    if (!wantSound) return;
    if (activeIsFile()) {
      dom.video.muted = false;
      dom.video.volume = 1;
    } else if (act?.p && act.ready) {
      act.p.unMute();
      act.p.setVolume(100);
    }
    publish({ soundOn: true });
    scheduleVerify(300);
  };

  /* تصريحٌ متقدّم — الجسدُ في قسم المشغّلَين أسفل، والنداءُ بعد البناء */
  let maybePreload: () => void = () => undefined;

  const onDrewFrame = () => {
    clearStall();
    setPhase("playing");
    /* D-761: الظاهرُ ثبت رسمُه — الآن يحقّ للخفيّ أن يسبق بالتحميل */
    maybePreload();
  };

  /* 🆕 D-760 (بلاغ أحمد: «كيف أسرّع؟»): مسبارُ رفعِ السِّتر — بعد حدث
     PLAYING نقرأ `getCurrentTime()` كلَّ إطارٍ حتى ثانيتين ونصف، فيُرفع
     الغلافُ مع أوّل حركةٍ فعليّةٍ بدل انتظار دورة العدّاد (حتى ٣٠٠م.ث).
     العدّادُ نفسُه باقٍ على فتراته (المواصفة سادسًا) — هذا للسِّتر فقط. */
  let veilProbe: number | null = null;
  stopVeilProbe = () => {
    if (veilProbe !== null) {
      window.cancelAnimationFrame(veilProbe);
      veilProbe = null;
    }
  };
  const startVeilProbe = () => {
    stopVeilProbe();
    const t0 = performance.now();
    const step = () => {
      veilProbe = null;
      if (destroyed || phase === "playing") return;
      const t = readTime();
      if (t && t.now > 0.1) {
        onDrewFrame();
        publish({ time: t });
        return;
      }
      if (performance.now() - t0 < 2500) veilProbe = window.requestAnimationFrame(step);
    };
    veilProbe = window.requestAnimationFrame(step);
  };

  const startTick = () => {
    stopTick();
    tick = window.setInterval(() => {
      const t = readTime();
      /* 🔑 السترُ لا يُرفع إلا على عقربٍ تحرّك (المواصفة رابعًا/٤-٥):
         حالةُ PLAYING وحدَها نيّة — والزمنُ فوق ٠٫١ هو الرسمُ الفعليّ.
         ⚠️ و«stalled» تُشفى بالعقرب أيضاً: بطيءٌ عرضنا له الزرَّ ثم
         انطلق من نفسه تُكشف صورتُه — لا يعمل خلف الغلاف */
      /* أيُّ حالةٍ غير «playing» وعقربُها يتحرّك (والعدّادُ لا يدور إلا
         بعد حدث PLAYING) تُقلب «playing» — ومنها «paused» بعد عودةٍ من
         الخلفيّة: بدونها يعمل المقطعُ خلف الغلاف وزرُّ تشغيلٍ كاذب فوقه */
      if (t && t.now > 0.1 && phase !== "playing") onDrewFrame();
      publish({ time: t });
    }, TICK_MS);
  };

  const armStall = () => {
    clearStall();
    stall = window.setTimeout(() => {
      /* ٨ ثوانٍ بلا حركة: الغلافُ باقٍ والزرُّ ظاهرٌ والمحاولةُ ضغطةٌ
         واحدة — ولا تُجبَر حالةُ تشغيلٍ بمؤقّتٍ أبداً (رابعًا/٦، ١٠) */
      if (phase === "loading") setPhase("stalled");
    }, STALL_MS);
  };

  /* ---- المصدران ---- */
  const pauseCurrent = () => {
    if (activeIsFile()) dom.video.pause();
    else if (act?.p && act.ready) {
      expectPause = true;
      act.p.pauseVideo();
    }
  };

  const clearActive = () => {
    showOverlay(false);
    stopTick();
    clearStall();
    activeId = null;
    publish({ activeId: null, time: null });
    setPhase("idle");
  };

  /* التصريحُ المتقدّم يفكّ الدورَ بين الخطأ والمصالحة */
  let reconcile: () => void = () => undefined;

  const onPlayerError = () => {
    /* المواصفة ثامنًا: بديلٌ واحدٌ لكلِّ مفتاحٍ مهما تكرّرت رسائلُ خطئه */
    if (advancedFor === keyIdx) return;
    advancedFor = keyIdx;
    const slot = activeSlot();
    const failedId = activeId;
    if (!slot || !failedId) return;
    const next = keyIdx + 1;
    if (next < slot.item.keys.length) {
      keyIdx = next;
      act?.p?.mute();
      if (act) act.key = slot.item.keys[next];
      act?.p?.loadVideoById(slot.item.keys[next]);
      return;
    }
    /* نفدت البدائل: البطاقةُ تُستبدل/تُحذف والدورُ لأوضح الظاهرين */
    exhausted.add(failedId);
    const cb = unavailableCb.get(failedId);
    clearActive();
    cb?.();
    window.setTimeout(() => {
      if (!destroyed) reconcile();
    }, 0);
  };

  /* ===== قسمُ المشغّلَين المتناوبَين (D-761) ===== */

  /** المفتاحُ الذي يجب أن يعرضه الظاهرُ الآن — مصدرُ الحقيقة عند سباق الإقلاع */
  const desiredActiveKey = (): string | null => {
    const s = activeSlot();
    if (!s || providerOf(s.item) === "file") return null;
    return s.item.keys[keyIdx] ?? null;
  };

  /** الظاهرُ مرئيٌّ فوق، والخفيُّ شفّافٌ تحت — ولا يُسمَع الخفيُّ أبداً */
  const applyRoles = () => {
    if (act) {
      act.frame.style.opacity = "1";
      act.frame.style.zIndex = "2";
    }
    if (sby) {
      sby.frame.style.opacity = "0";
      sby.frame.style.zIndex = "1";
    }
  };

  const activeStateChange = (e: { data: number }) => {
    const yts = window.YT?.PlayerState;
    if (!yts) return;
    if (e.data === yts.PLAYING) {
      expectPause = false;
      startTick();
      startVeilProbe();
      scheduleVerify(150);
      return;
    }
    if (e.data === yts.PAUSED || e.data === yts.ENDED) {
      /* صدى إيقافِنا نحن يُستهلك ولا يدخل مُعافاةَ الرفض */
      const echoed = expectPause && e.data === yts.PAUSED;
      if (echoed) expectPause = false;
      /* 🆕 D-760: توقّفٌ لحظاتٍ بعد فكِّ كتمٍ آليٍّ = WebKit رفض الصوتَ
         فأوقف — نستعيد التشغيلَ صامتين ونُصدِق الأيقونة (علمُ الجلسة
         يبقى: رفضٌ عارضٌ لا يُطفئ الحمل). لا نتعافى والصفحةُ مخفيّة. */
      if (
        !echoed &&
        e.data === yts.PAUSED &&
        autoUnmuteAt &&
        Date.now() - autoUnmuteAt < 1500 &&
        activeId &&
        !activeIsFile() &&
        document.visibilityState === "visible"
      ) {
        autoUnmuteAt = 0;
        act?.p?.mute();
        publish({ soundOn: false });
        act?.p?.playVideo();
        return;
      }
      stopTick();
      publish({ time: readTime() });
      if (activeId && phase === "playing") setPhase("paused");
    }
  };

  const standbyStateChange = (rec: PlayerRec, e: { data: number }) => {
    const yts = window.YT?.PlayerState;
    if (!yts) return;
    if (e.data === yts.PLAYING) {
      /* بلغ أوّلَ إطار: عازلٌ دافئٌ يكفي — يقف صامتاً بانتظار الترقية.
         وأيُّ تشغيلٍ شاردٍ لاحتياطٍ خاملٍ يُخمَد فوراً: الخفيُّ لا يعمل */
      rec.p?.pauseVideo();
      if (rec.preload === "loading") rec.preload = "ready";
    }
  };

  /* 🔴 ⚖️ نقضُ «autoplay:0 + playVideo من onReady» بعد فشل iPhone الفعليّ:
     الإطارُ يُبنى يدويّاً بمحاولةٍ ذاتيّةٍ صامتة (`autoplay=1&mute=1`) —
     وحدَها محاولةُ المشغّل نفسِه تُطلق onAutoplayBlocked عند المنع.
     و`allow="autoplay"` جسرُ تفويض الإيماءة إلى داخل الإطار على iOS.
     ⚠️ الإطارُ والدورُ يُثبَّتان **قبل** انتظار الواجهة — نداءان متسارعان
     كانا يبنيان مشغّلَين لدورٍ واحد. */
  const bootPlayer = async (firstKey: string, asActive: boolean): Promise<void> => {
    const frame = document.createElement("iframe");
    const q = new URLSearchParams({
      autoplay: "1",
      mute: "1",
      playsinline: "1",
      controls: "0",
      rel: "0",
      enablejsapi: "1",
      origin: window.location.origin,
    });
    frame.src = `https://www.youtube-nocookie.com/embed/${firstKey}?${q.toString()}`;
    frame.allow = "autoplay; encrypted-media; picture-in-picture";
    frame.style.position = "absolute";
    frame.style.inset = "0";
    frame.style.width = "100%";
    frame.style.height = "100%";
    frame.style.border = "0";
    dom.ytHost.appendChild(frame);
    const rec: PlayerRec = {
      p: null,
      ready: false,
      frame,
      key: firstKey,
      preload: asActive ? "idle" : "loading",
      failedKey: null,
    };
    if (asActive) act = rec;
    else sby = rec;
    applyRoles();
    const yt = await loadYouTubeApi();
    if (destroyed) return;
    rec.p = new yt.Player(frame, {
      events: {
        onReady: () => {
          rec.ready = true;
          /* بالترتيب المُملى: كتمٌ ثم صفرُ صوت — أوّلُ تشغيلٍ صامتٌ دائماً */
          rec.p?.mute();
          rec.p?.setVolume(0);
          if (rec !== act) return;
          publish({ soundOn: false });
          const want = desiredActiveKey();
          if (!want) return;
          if (rec.key !== want) {
            /* القارئُ سبق الإقلاعَ إلى بطاقةٍ أخرى — نلحق به */
            rec.key = want;
            rec.p?.loadVideoById(want);
          } else {
            rec.p?.playVideo();
          }
        },
        onStateChange: (e) => {
          if (rec === act) activeStateChange(e);
          else standbyStateChange(rec, e);
        },
        onError: () => {
          if (rec === act) {
            onPlayerError();
          } else {
            /* فشلُ تحميلٍ مسبق: يُهمَل بصمتٍ ولا يُعاد لنفس المفتاح —
               مسارُ الخطأ الظاهرُ (بديلٌ ثم حذفٌ) يبقى عند التنشيط الفعليّ */
            rec.failedKey = rec.key;
            rec.key = null;
            rec.preload = "idle";
          }
        },
        onAutoplayBlocked: () => {
          if (rec === act) {
            /* الغلافُ يبقى وزرُّ تشغيلٍ واضح — لا iframe أسود (رابعًا/٧) */
            clearStall();
            stopTick();
            setPhase("blocked");
          } else {
            rec.failedKey = rec.key;
            rec.key = null;
            rec.preload = "idle";
          }
        },
      },
    });
  };

  /** التحميلُ المسبق: مفتاحُ أوّلِ بطاقةِ يوتيوبَ بعد النشطة — واحدٌ لا غير */
  maybePreload = () => {
    if (destroyed || !activeId) return;
    if (readSnap().manualOnly || isSavingData()) return;
    if (document.visibilityState === "hidden") return;
    const ids = [...slots.keys()];
    const at = ids.indexOf(activeId);
    if (at < 0) return;
    let nextKey: string | null = null;
    for (let i = at + 1; i < ids.length; i++) {
      const s = slots.get(ids[i]);
      if (!s || exhausted.has(ids[i])) continue;
      /* بطاقةُ ملفٍّ تُتخطّى: بثُّها المباشرُ سريعٌ أصلاً (D-758) —
         ويوتيوبُ التي بعدها هي المستفيدةُ من السبق */
      if (providerOf(s.item) === "file") continue;
      nextKey = s.item.keys[0] ?? null;
      break;
    }
    if (!nextKey) return;
    if (act?.key === nextKey) return;
    if (sby && (sby.key === nextKey || sby.failedKey === nextKey)) return;
    if (!sby) {
      void bootPlayer(nextKey, false);
      return;
    }
    if (!sby.ready || !sby.p) return;
    sby.preload = "loading";
    sby.key = nextKey;
    sby.p.mute();
    sby.p.setVolume(0);
    sby.p.loadVideoById(nextKey);
  };

  /** تنشيطُ بطاقةِ يوتيوب: ترقيةٌ لحظيّةٌ إن سبق الاحتياطُ بهذا المفتاح،
      وإلا مسارُ D-760 (تحميلٌ في الظاهر نفسِه)، وإلا إقلاعٌ أوّل */
  const activateYt = (firstKey: string) => {
    dom.video.pause();
    /* بطاقةُ يوتيوب: آخرُ إطارِ ملفٍّ لا يفترش فوق الإطار الرسميّ */
    dom.video.style.display = "none";

    if (sby?.ready && sby.p && sby.key === firstKey) {
      /* الترقية: تبادلُ أدوارٍ — المشغّلُ الجاهزُ يصعد والقديمُ يصير احتياطاً */
      const old = act;
      act = sby;
      sby = old;
      if (sby) {
        /* وقفتُه للتوّ في منتصف مقطعه — ليس تحميلاً مسبقاً لشيء */
        sby.key = null;
        sby.preload = "idle";
      }
      applyRoles();
      expectPause = false;
      act.preload = "idle";
      const carry = wantSound && soundSessionUnlocked;
      if (carry) {
        act.p?.unMute();
        act.p?.setVolume(100);
        autoUnmuteAt = Date.now();
      } else {
        act.p?.mute();
      }
      publish({ soundOn: carry });
      act.p?.playVideo();
      scheduleVerify(600);
      return;
    }

    if (act?.p && act.ready) {
      /* مسار D-760 كما هو: حملُ الصوت وتحميلٌ في الظاهر نفسِه */
      const carry = wantSound && soundSessionUnlocked;
      if (carry) {
        act.p.unMute();
        act.p.setVolume(100);
        autoUnmuteAt = Date.now();
      } else {
        act.p.mute();
      }
      publish({ soundOn: carry });
      act.key = firstKey;
      act.p.loadVideoById(firstKey);
      scheduleVerify(600);
      return;
    }

    if (act) return; /* يقلع الآن — onReady يلحق بالمفتاح المطلوب */
    void bootPlayer(firstKey, true);
  };

  /* ---- التنشيط (قلبُ المتحكّم) ---- */
  const activate = (id: string, viaGesture: boolean) => {
    const slot = slots.get(id);
    if (!slot) return;

    if (activeId === id) {
      /* بطاقةٌ نشطةٌ ضُغط زرُّها: استئنافٌ داخل الإيماءة نفسِها —
         بلا إعادةِ إنشاءِ iframe (رابعًا/٨-٩) */
      if (viaGesture) {
        setPhase("loading");
        armStall();
        if (activeIsFile()) {
          dom.video.muted = true;
          void dom.video.play().catch(() => {
            if (activeId === id) setPhase("stalled");
          });
          startTick();
          startVeilProbe();
        } else if (act?.p && act.ready) {
          /* زرُّ التشغيل يبدأ صامتاً دائماً (حالة الواجهة ٣) — والصوتُ
             لزرِّ الصوت بعد أن تتحرّك الصورة */
          act.p.mute();
          act.p.playVideo();
        }
      }
      return;
    }

    /* أوقف السابقةَ أوّلاً — لا يعمل مقطعان معاً أبداً (ثالثًا/٤) */
    pauseCurrent();
    showOverlay(false);
    stopTick();
    clearStall();
    keyIdx = 0;
    advancedFor = -1;
    activeId = id;
    publish({ activeId: id, time: null });
    setPhase("loading");
    armStall();

    if (providerOf(slot.item) === "file") {
      if (act?.p && act.ready) {
        expectPause = true;
        act.p.pauseVideo();
      }
      dom.video.style.display = "";
      if (!slot.item.fileUrl) return;
      if (dom.video.src !== slot.item.fileUrl) dom.video.src = slot.item.fileUrl;
      /* 🆕 D-760: عنصرُ الملفّ يحمل نيّةَ الصوت هو الآخر — وإن رفض
         WebKit تشغيلاً مصوَّتاً عُدنا صامتين بدل بطاقةٍ ميتة
         (علمُ الجلسة يبقى — الرفضُ عارضٌ لا يُطفئ الحمل) */
      const carry = wantSound && soundSessionUnlocked;
      dom.video.muted = !carry;
      if (carry) dom.video.volume = 1;
      publish({ soundOn: carry });
      /* فيديو جديد: صفّر الزمنَ ولا تعرض مدةَ سابقه (سادسًا/٨) */
      dom.video.currentTime = 0;
      void dom.video.play().catch(() => {
        if (activeId !== id) return;
        if (carry) {
          dom.video.muted = true;
          publish({ soundOn: false });
          void dom.video.play().catch(() => {
            if (activeId === id) setPhase(viaGesture ? "stalled" : "blocked");
          });
          return;
        }
        setPhase(viaGesture ? "stalled" : "blocked");
      });
      startTick();
      startVeilProbe();
      return;
    }

    activateYt(slot.item.keys[0]);
  };

  /* ---- اختيارُ البطاقة النشطة (المواصفة ثالثًا) ---- */
  reconcile = () => {
    if (readSnap().manualOnly) return;
    let bestId: string | null = null;
    let bestRatio = 0;
    for (const [id, ratio] of ratios) {
      if (exhausted.has(id)) continue;
      if (ratio > bestRatio) {
        bestId = id;
        bestRatio = ratio;
      }
    }
    const activeRatio = activeId ? (ratios.get(activeId) ?? 0) : 0;

    if (activeId && activeRatio >= STOP_RATIO) {
      if (
        bestId &&
        bestId !== activeId &&
        bestRatio >= START_RATIO &&
        bestRatio > activeRatio + SWITCH_GAP
      ) {
        activate(bestId, false);
      }
      return;
    }
    if (activeId && activeRatio < STOP_RATIO) {
      /* خرجت عن ١٥٪: إيقافُ المقطع والعدّاد معاً (ثالثًا/٥) */
      pauseCurrent();
      clearActive();
    }
    if (bestId && bestRatio >= START_RATIO) activate(bestId, false);
  };

  /* ---- محاذاةُ الطبقة ----
     🔴 ⚖️ قلبُ السِّتر بعد فشل iPhone: كانت الطبقةُ نفسُها هي السِّتر
     (شفّافةٌ حتى يثبت الرسم) — **فيحاول iOS تشغيلَ فيديو داخل طبقةٍ
     غيرِ مرسومة**. الآن الطبقةُ ظاهرةٌ ما دامت بطاقةٌ نشطة، **والغلافُ
     فوقَها هو السِّتر** (z-40 في البطاقة) يتلاشى فقط بعد عقربٍ تحرّك —
     فالإطارُ مرسومٌ من أوّل لحظة ولا يُرى إلا ما ثبتت حركتُه. */
  const alignOverlay = () => {
    if (destroyed || !activeId) return;
    const slot = slots.get(activeId);
    if (!slot) return;
    const el = dom.overlay;
    /* قياسٌ طازجٌ في كلِّ نداء — لا قياسَ قديماً بعد لفٍّ أو تدوير */
    const r = slot.area.getBoundingClientRect();
    el.style.transform = `translate(${r.left}px, ${r.top}px)`;
    el.style.width = `${r.width}px`;
    el.style.height = `${r.height}px`;
  };
  const syncOverlay = () => {
    if (destroyed) return;
    if (!activeId) {
      showOverlay(false);
    } else if (slots.get(activeId)) {
      alignOverlay();
      showOverlay(true);
    }
    raf = window.requestAnimationFrame(syncOverlay);
  };

  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      /* الخلفيّة: إيقافٌ فوريٌّ وعدّادٌ ساكن (ثالثًا/٦، سادسًا/٦) —
         والاحتياطُ في منتصف تحميله يقف ويُلغى: لا استهلاكَ بياناتٍ
         مسبقاً في الخلفيّة، وسيُعاد عند العودة من onDrewFrame */
      pauseCurrent();
      stopTick();
      if (sby?.p && sby.preload === "loading") {
        sby.p.pauseVideo();
        sby.preload = "idle";
        sby.key = null;
      }
      return;
    }
    /* العودة: استئنافٌ صامتٌ دائماً — لا صوتَ آليّاً (ثالثًا/٧) */
    if (!activeId) return;
    if (activeIsFile()) {
      dom.video.muted = true;
      void dom.video.play().catch(() => undefined);
      /* الإخفاءُ أوقف العدّاد — وعنصرُ الملفّ بلا حدثِ PLAYING يعيد
         تدويرَه، فبدون هذا يعمل المقطعُ والعقربُ ساكنٌ والسِّترُ نازل */
      startTick();
    } else if (act?.p && act.ready) {
      act.p.mute();
      act.p.playVideo();
    }
    /* أُمر بالكتم فتُنشر الأيقونةُ بالأمر — لا بقراءةٍ متزامنةٍ عتيقة.
       (نيّةُ الصوت وقفلُه باقيان: البطاقةُ التالية تحملهما كالمعتاد.) */
    publish({ soundOn: false });
  };

  return {
    start() {
      /* بذرةُ النيّة من الكوكي — والقفلُ يُفكّ بإيماءةِ هذه الجلسة وحدَها */
      wantSound = getSoundPref();
      const manualOnly = typeof IntersectionObserver === "undefined" || isSavingData();
      publish({ manualOnly });
      if (!manualOnly) {
        io = new IntersectionObserver(
          (entries) => {
            for (const e of entries) {
              for (const [id, s] of slots) {
                if (s.area === e.target) {
                  ratios.set(id, e.intersectionRatio);
                  break;
                }
              }
            }
            reconcile();
          },
          { threshold: [0, STOP_RATIO, START_RATIO, 1] },
        );
        for (const [, s] of slots) io.observe(s.area);
      }
      document.addEventListener("visibilitychange", onVisibility);
      /* محاذاةٌ فوريّةٌ عند كلِّ ما يحرّك البطاقةَ تحت الطبقة (فقرة A):
         لفُّ أيِّ حاويةٍ (`capture` لأنّ scroll لا يفقع) والتدويرُ
         وviewport الحقيقيُّ في iOS — وحلقةُ rAF تبقى شبكةَ الأمان */
      window.addEventListener("scroll", alignOverlay, { passive: true, capture: true });
      window.addEventListener("resize", alignOverlay);
      window.addEventListener("orientationchange", alignOverlay);
      window.visualViewport?.addEventListener("resize", alignOverlay);
      window.visualViewport?.addEventListener("scroll", alignOverlay);
      raf = window.requestAnimationFrame(syncOverlay);
    },

    register(id: string, area: HTMLElement, item: TrailerSlotItem) {
      slots.set(id, { area, item });
      ratios.set(id, 0);
      io?.observe(area);
      return () => {
        io?.unobserve(area);
        slots.delete(id);
        ratios.delete(id);
        unavailableCb.delete(id);
        exhausted.delete(id);
        if (activeId === id) {
          pauseCurrent();
          clearActive();
          window.setTimeout(() => {
            if (!destroyed) reconcile();
          }, 0);
        }
      };
    },

    registerUnavailable(id: string, cb: () => void) {
      unavailableCb.set(id, cb);
    },

    tapPlay(id: string) {
      activate(id, true);
      /* نيّةُ الصوت تُطبَّق هنا — داخل إيماءةٍ حقيقيّةٍ وبعد أمرِ
         التشغيل؛ هذه الضغطةُ تفكّ قفلَ WebKit فتحمل البطاقاتُ التاليةُ
         الصوتَ بأنفسها */
      applySoundInGesture();
    },

    /* 🔴 زرُّ الصوت **لا يشغّل شيئاً** (بلاغ iPhone: صار هو زرَّ التشغيل
       فعليّاً لأنّ إيماءتَه كانت تحمل playVideo). التشغيلُ لزرِّ التشغيل
       وحدَه — وهذا يبدّل الصوتَ فقط على مشغّلٍ جاهز. */
    tapSound() {
      const slot = activeSlot();
      if (!slot) return;
      const wantOn = !readSnap().soundOn;
      /* الاختيارُ الصريح يحدّث النيّةَ المحمولةَ عبر البطاقات (D-760) */
      wantSound = wantOn;
      if (activeIsFile()) {
        dom.video.muted = !wantOn;
        if (wantOn) dom.video.volume = 1;
      } else if (act?.p && act.ready) {
        if (wantOn) {
          /* داخل الضغطة نفسِها: unMute + volume (خامسًا/٢) — بلا play */
          act.p.unMute();
          act.p.setVolume(100);
        } else {
          act.p.mute();
        }
      }
      /* الحقيقةُ تُقرأ ثم يُكتب الكوكي — لا ادّعاءَ نجاحٍ رفضه المتصفّح
         (خامسًا/٣-٦): إن منعه Safari بقيت الأيقونةُ على «شغّل الصوت» */
      window.setTimeout(() => {
        if (destroyed) return;
        const on = verifySound();
        /* نجاحُ فكِّ الكتم بإيماءةٍ = قفلُ الجلسة مفكوك (D-761) */
        if (on) soundSessionUnlocked = true;
        if (on === wantOn) writeTrailerSound(on);
      }, 200);
    },

    destroy() {
      /* لا timers ولا observers بعد unmount (اختبار ١٦) */
      destroyed = true;
      if (verifyTimer !== null) {
        window.clearTimeout(verifyTimer);
        verifyTimer = null;
      }
      stopVeilProbe();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("scroll", alignOverlay, { capture: true });
      window.removeEventListener("resize", alignOverlay);
      window.removeEventListener("orientationchange", alignOverlay);
      window.visualViewport?.removeEventListener("resize", alignOverlay);
      window.visualViewport?.removeEventListener("scroll", alignOverlay);
      stopTick();
      clearStall();
      if (raf !== null) {
        window.cancelAnimationFrame(raf);
        raf = null;
      }
      io?.disconnect();
      io = null;
      for (const rec of [act, sby]) {
        try {
          rec?.p?.destroy();
        } catch {
          /* مشغّلٌ لم يكتمل إنشاؤه */
        }
      }
      act = null;
      sby = null;
      dom.ytHost.replaceChildren();
    },
  };
}

type Engine = ReturnType<typeof createEngine>;

/* ===== المكوّن: قشرةٌ حول المحرّك ===== */

export function TrailerPlayback({
  children,
  soundPref,
}: {
  children: React.ReactNode;
  /** آخرُ اختيارٍ محفوظٍ للصوت — **يُحاوَل بعد أوّل تفاعلٍ حقيقيٍّ فقط** */
  soundPref: boolean;
}) {
  const snapRef = useRef<ControllerSnapshot>({
    activeId: null,
    phase: "idle",
    soundOn: false,
    time: null,
    manualOnly: false,
  });
  const subsRef = useRef(new Set<() => void>());
  const engineRef = useRef<Engine | null>(null);
  const soundPrefRef = useRef(soundPref);
  const overlay = useRef<HTMLDivElement>(null);
  const ytHost = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  /** تسجيلاتٌ وصلت قبل جاهزيّة المحرّك — البطاقاتُ الأبناء تُركَّب قبل أثر الأب */
  const earlySlots = useRef(
    new Map<
      string,
      { area: HTMLElement; item: TrailerSlotItem; cleanup: { current: (() => void) | null } }
    >(),
  );
  const earlyUnavailable = useRef(new Map<string, () => void>());

  useEffect(() => {
    soundPrefRef.current = soundPref;
  }, [soundPref]);

  useEffect(() => {
    LIVE_CONTROLLERS += 1;
    if (LIVE_CONTROLLERS > 1) {
      console.warn("[trailers] two playback controllers mounted at once");
    }
    const overlayEl = overlay.current;
    const ytHostEl = ytHost.current;
    const videoEl = video.current;
    if (!overlayEl || !ytHostEl || !videoEl) {
      return () => {
        LIVE_CONTROLLERS -= 1;
      };
    }

    const engine = createEngine(
      { overlay: overlayEl, ytHost: ytHostEl, video: videoEl },
      (patch) => {
        snapRef.current = { ...snapRef.current, ...patch };
        subsRef.current.forEach((f) => f());
      },
      () => snapRef.current,
      () => soundPrefRef.current,
    );
    engineRef.current = engine;
    /* البطاقاتُ التي سبقت المحرّكَ تُسلَّم له الآن — وتسجيلاتُ التعذّر
       معها: ضياعُها كان يحوّل نفادَ البدائل إلى حلقةِ تنشيطٍ أبديّة */
    for (const [id, s] of earlySlots.current) {
      s.cleanup.current = engine.register(id, s.area, s.item);
    }
    for (const [id, cb] of earlyUnavailable.current) engine.registerUnavailable(id, cb);
    engine.start();

    return () => {
      engineRef.current = null;
      engine.destroy();
      LIVE_CONTROLLERS -= 1;
    };
  }, []);

  const register = useCallback((id: string, area: HTMLElement, item: TrailerSlotItem) => {
    const engine = engineRef.current;
    if (engine) {
      const off = engine.register(id, area, item);
      return () => off();
    }
    const holder = { current: null as (() => void) | null };
    earlySlots.current.set(id, { area, item, cleanup: holder });
    return () => {
      earlySlots.current.delete(id);
      holder.current?.();
    };
  }, []);

  const registerUnavailable = useCallback((id: string, cb: () => void) => {
    if (engineRef.current) engineRef.current.registerUnavailable(id, cb);
    else earlyUnavailable.current.set(id, cb);
  }, []);
  const tapPlay = useCallback((id: string) => {
    engineRef.current?.tapPlay(id);
  }, []);
  const tapSound = useCallback(() => {
    engineRef.current?.tapSound();
  }, []);
  const subscribe = useCallback((cb: () => void) => {
    subsRef.current.add(cb);
    return () => {
      subsRef.current.delete(cb);
    };
  }, []);
  const getSnapshot = useCallback(() => snapRef.current, []);

  const api = useMemo<ControllerApi>(
    () => ({ register, registerUnavailable, tapPlay, tapSound, subscribe, getSnapshot }),
    [register, registerUnavailable, tapPlay, tapSound, subscribe, getSnapshot],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      {/* الطبقةُ الواحدة: مشغّلُ يوتيوب + عنصرُ الملفّ — لمسُها معطَّلٌ
          بالكامل فلا يبتلع الإطارُ تمريرَ الصفحة (المواصفة ١١/٦) */}
      <div
        ref={overlay}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-30 overflow-hidden opacity-0"
        /* زوايا الطبقة = زوايا رأس البطاقة (سلّم D-454: 2xl = 14px) —
           طبقةٌ مربّعةٌ فوق بطاقةٍ مدوّرةٍ تفضح نفسَها في الأركان */
        style={{ willChange: "transform", borderRadius: "14px 14px 0 0" }}
      >
        <div ref={ytHost} className="h-full w-full" />
        {/* عنصرُ الملفّ يعتلي مضيفَ يوتيوب حين يكون مزوّدُ البطاقة ملفّاً */}
        <video
          ref={video}
          playsInline
          loop
          muted
          preload="metadata"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
    </Ctx.Provider>
  );
}
