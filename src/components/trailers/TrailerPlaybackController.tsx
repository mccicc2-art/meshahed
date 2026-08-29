"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Icon } from "../Icon";
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
  /** الصيغةُ الكائنيّةُ الرسمية تحمل `startSeconds` — استئنافُ آخرِ نقطة (D-762) */
  loadVideoById(videoId: string | { videoId: string; startSeconds?: number }): void;
  /* ⚖️ D-762: التقديمُ عاد بطلب أحمد («تقديم وتأخير») — نقضُ حذفِ
     D-759 سابعًا، وبالواجهة الرسمية وحدَها كعادة البيت */
  seekTo(seconds: number, allowSeekAhead: boolean): void;
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
  /** 🆕 D-762: التكبيرُ المسرحيّ — الطبقةُ تملأ الشاشةَ داخل التطبيق
      (التكبيرُ الأصليُّ لإطار يوتيوب ممنوعٌ على iPhone في WebKit) */
  expanded: boolean;
  /** 🆕 D-764 (طلب أحمد): الأزرارُ تتوارى بعد ٥ ثوانِ تشغيلٍ متواصل —
      ولمسةُ السطح تُظهرها قبل أن تُوقف، وكلُّ تفاعلٍ يعيد عدَّها */
  controlsVisible: boolean;
}

interface ControllerApi {
  register(id: string, area: HTMLElement, item: TrailerSlotItem): () => void;
  registerUnavailable(id: string, cb: () => void): void;
  tapPlay(id: string): void;
  tapSound(): void;
  /** ⚖️ D-762: التقديمُ عاد بطلب صاحبه — بثوانٍ مطلقةٍ على النشطة */
  seekTo(seconds: number): void;
  toggleExpand(): void;
  /** 🆕 D-764: لمسةُ إظهارِ الأزرار المتوارية — تعيد عدَّ الثواني الخمس */
  pokeControls(): void;
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
/** 🆕 D-779: مهلةُ المحاولة الصامتة الواحدة قبل إظهار زرِّ التشغيل */
const RETRY_MS = 1500;
/** 🆕 D-764: الأزرارُ تتوارى بعد هذه المدّة من تشغيلٍ متواصل.
    ⚖️ 🆕 **٥ ← ٢** (D-779، حكمُ أحمد: «٥ ثواني عشان تختفي كثير خليها
    ثانيتين») — **نقضٌ لرقمه هو في D-764**، وهو صاحبُه. */
const CONTROLS_HIDE_MS = 2000;

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
  /** D-763: ستارةُ سوادِ التكبير — حول صندوق 16:9 المُمركز */
  scrim: HTMLDivElement;
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
    /** 🆕 D-766: بلغ PLAYING مرّةً — جلسةُ تشغيلٍ قائمةٌ تقبل أوامرَ iOS
        اللاحقة. والبِكرُ (أُقلع مخفيّاً ولم يبدأ قطّ) لا يُرقّى: أمرُ
        تشغيله الأوّلُ يُبتلع بصمت (عطبُ D-759 الأصليّ نفسُه) */
    played: boolean;
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
      تُحمَل عبر البطاقات. `wantSound` آخرُ اختيارٍ صريح (بذرتُه الكوكي —
      ⚖️ 🆕 D-771 بحكمه «دائماً الصوت شغال والي مزعجه يحط صامت»: بذرةُ
      الافتراض صارت **مفتوحة** ناقضةً افتراضَ D-726 الصامت، والكاتمُ
      وحدَه يُحفظ كتمُه). ⚖️ وسقط معها شرطُ «قفلِ الجلسة المفكوك»
      (D-760/761): الصوتُ **يُحاوَل دائماً** ما دامت النيّةُ قائمةً،
      ورفضُ WebKit يلتقطه مسارُ `autoUnmuteAt` فيُستعاد التشغيلُ صامتاً
      وتُختم البطاقةُ `soundBlocked` فلا تدور حلقةُ فكٍّ/رفضٍ إلى الأبد.
      (أوّلُ إقلاعِ كلِّ إطارٍ يبقى صامتاً — قانونُ iOS — والفكُّ يقع
      مع أوّل PLAYING.) */
  let wantSound = false;
  /** 🆕 D-771: رفض WebKit فكَّ الصوتِ لهذه البطاقة — لا يُعاد عليها
      (يُصفَّر عند تنشيطِ بطاقةٍ أو بإيماءةِ صوتٍ صريحة) */
  let soundBlocked = false;
  let verifyTimer: number | null = null;
  /** 🆕 D-762 (بلاغ أحمد: «ارجع فوق يعيده من البداية»): ذاكرةُ مواضعَ
      لكلِّ بطاقة — تُقيَّد عند مغادرتها وتُستأنف عند العودة. المفتاحُ
      يُحفظ معها كي لا يُستأنف بديلُ خطأٍ من موضعِ غيرِه. */
  const positions = new Map<string, { key: string; t: number }>();
  /** التكبيرُ المسرحيّ (D-762) — علمُ المحرّك، والقشرةُ تقرؤه من اللقطة */
  let expandedFlag = false;
  /** لحظةُ فكِّ كتمٍ آليٍّ (بلا إيماءة) — لكشف رفض WebKit والتعافي صامتاً */
  let autoUnmuteAt = 0;
  /** إيقافٌ أمرنا به نحن (تبديلٌ/خلفيّة) — صداه PAUSED ليس رفضَ WebKit:
      بدون هذا التمييز كان صدى إيقافِ السابقة يكتم اللاحقةَ المحمولةَ الصوت */
  let expectPause = false;
  /** 🆕 مفتاحُ آخرِ مقطعٍ جُرِّبت له محاولةٌ صامتة — **مرّةٌ لكلِّ مفتاح**
      (D-779): محاولةٌ بلا حدٍّ تصير حلقةً لا تنتهي أمام مقطعٍ ميّت. */
  let retriedKey: string | null = null;
  /** 🔴 **ومؤقّتٌ مستقلٌّ لا `stall`** (D-779): أوّلُ كتابةٍ أعادت استعمال
      مؤقّت التعثّر، **و`armStall` تمسحه وتضع ثمانيَ ثوانٍ مكانَ ثانيةٍ
      ونصف** — فلا يظهر الزرُّ في وقته. **وأمسكه المختبرُ (٩/١٠) قبل
      الشحن.** **ومؤقّتان لمعنيين مختلفين، لا واحدٌ يتنازعان عليه.** */
  let retryTimer: number | null = null;
  let destroyed = false;

  /* 🆕 D-764: توارِي الأزرار — مرئيّةٌ دائماً خارج التشغيل، وتتوارى بعد
     ٥ ثوانِ تشغيلٍ متواصل؛ كلُّ تفاعلٍ (لمسة/صوت/تقديم) يعيد العدّ */
  let controlsTimer: number | null = null;
  let controlsShown = true;
  const publishControls = (on: boolean) => {
    if (controlsShown === on) return;
    controlsShown = on;
    publish({ controlsVisible: on });
  };
  const clearControlsTimer = () => {
    if (controlsTimer !== null) {
      window.clearTimeout(controlsTimer);
      controlsTimer = null;
    }
  };
  const armControlsTimer = () => {
    clearControlsTimer();
    controlsTimer = window.setTimeout(() => {
      controlsTimer = null;
      if (!destroyed && phase === "playing") publishControls(false);
    }, CONTROLS_HIDE_MS);
  };
  const pokeControls = () => {
    publishControls(true);
    if (phase === "playing") armControlsTimer();
    else clearControlsTimer();
  };

  const clearRetry = () => {
    if (retryTimer !== null) {
      window.clearTimeout(retryTimer);
      retryTimer = null;
    }
  };

  const setPhase = (next: SlotPhase) => {
    /* **ونجاحُ المحاولة يُسقط مؤقّتَها**: عقربٌ تحرّك فقُلبت «playing» */
    if (next !== "loading") clearRetry();
    phase = next;
    publish({ phase: next });
    if (next === "playing") armControlsTimer();
    else {
      clearControlsTimer();
      publishControls(true);
    }
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

  /** قيدُ موضعِ النشطة قبل مغادرتها (D-762) — أقلُّ من ثانيةٍ ضجيج */
  const rememberPosition = () => {
    if (!activeId) return;
    const t = readTime();
    if (!t || t.now < 1) return;
    const s = activeSlot();
    if (!s) return;
    const key = providerOf(s.item) === "file" ? s.item.fileUrl : (act?.key ?? null);
    if (!key) return;
    positions.set(activeId, { key, t: t.now });
    /* سقفٌ للذاكرة — الأقدمُ يسقط أوّلاً */
    if (positions.size > 80) {
      const first = positions.keys().next().value;
      if (first !== undefined) positions.delete(first);
    }
  };

  /* تصريحٌ متقدّم — الجسدُ بعد المحاذاة التي يستدعيها */
  let setExpanded: (on: boolean) => void = () => undefined;

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
        autoUnmuteAt = 0;
        soundBlocked = false;
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
    rememberPosition();
    setExpanded(false);
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
      /* 🆕 D-771 (حكمه: «دائماً الصوت شغال والي مزعجه يحط صامت» — وجذرُ
         بلاغِه «كل شوي أحصل المقطع صامت»): كلُّ PLAYING على بطاقةٍ
         صامتةٍ ونيّةُ الصوت قائمةٌ = محاولةُ فكٍّ فوريّة — الإقلاعُ
         الأوّل والترقيةُ والعودةُ من الخلفيّة كلُّها تمرّ من هنا فلا
         تبقى بطاقةٌ صامتةٌ خلافاً للنيّة. رفضُ WebKit يلتقطه مسارُ
         `autoUnmuteAt` أدناه فيُستعاد التشغيلُ صامتاً وتُختم البطاقةُ
         `soundBlocked` — «دائماً شغّال» مقدَّمةٌ على الصوت. */
      if (wantSound && !soundBlocked && !readSnap().soundOn && act?.p && act.ready) {
        act.p.unMute();
        act.p.setVolume(100);
        autoUnmuteAt = Date.now();
        publish({ soundOn: true });
      }
      scheduleVerify(300);
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
        /* 🆕 D-771: الرفضُ يختم البطاقةَ — وإلا دار PLAYING التالي على
           محاولةِ فكٍّ جديدةٍ فرفضٍ فإيقافٍ... حلقةً لا تنتهي */
        soundBlocked = true;
        act?.p?.mute();
        publish({ soundOn: false });
        act?.p?.playVideo();
        return;
      }
      /* نهايةُ المقطع تمسح موضعَه — العودةُ إليه بدايةٌ جديدة (D-762) */
      if (e.data === yts.ENDED && activeId) positions.delete(activeId);
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
  const bootPlayer = async (firstKey: string, asActive: boolean, startAt = 0): Promise<void> => {
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
    /* استئنافُ آخرِ نقطةٍ من الرابط نفسِه عند الإقلاع الأوّل (D-762) */
    if (startAt > 0) q.set("start", String(Math.floor(startAt)));
    frame.src = `https://www.youtube-nocookie.com/embed/${firstKey}?${q.toString()}`;
    frame.allow = "autoplay; encrypted-media; picture-in-picture";
    /* 🆕 D-763 (قرار أحمد بعد لقطة iPhone: «هذي ينفع تخفيها؟» ← «القصّ»):
       الإطارُ ثلاثةُ أضعافِ الصندوق ممركزٌ — الفيديو (بعرض الصندوق) يقع
       في الثلث الأوسط بالضبط والصندوقُ 16:9 دائماً، فشريطُ العنوان وصفُّ
       «فيديوهات أخرى» والشعارُ (المرسومةُ على حافتَي الإطار) تقع خارج
       القصّ ولا يُقصّ من الفيديو بكسل. ⚠️ يوتيوبُ ألغى كلَّ معاملات
       الإخفاء الرسمية، وهذا القصُّ خروجٌ نصيٌّ على شرط إظهار علامة
       المشغّل — **عُرض الثمنُ على أحمد واختاره مالكاً**. */
    frame.style.position = "absolute";
    frame.style.left = "0";
    frame.style.top = "-100%";
    frame.style.width = "100%";
    frame.style.height = "300%";
    frame.style.border = "0";
    /* 🔴 🆕 **ولا لمسةَ تصل الإطارَ أبداً** (D-779، بلاغُ أحمد: «مازالت
       علامة التوقف موجودة في نص الشاشة مع العلم احنا لغينا فكرة التوقف
       بالكامل»).
       🔑 **والعلامةُ ليست من رسمِنا**: بحثتُ في مكوّنات العلف كلِّها فلا
       رمزَ إيقافٍ واحد — **هي علامةُ يوتيوب نفسِه**، يرسمها حين تصل
       سطحَه لمسةٌ فيوقف. **و`controls=0` تخفي الشريطَ ولا تمنع اللمس.**
       ⚠️ **وأسطحُنا تغطّي البطاقةَ لا الإطار**: الإطارُ ثلاثةُ أضعاف
       الصندوق (قصُّ D-763) **فحوافُّه تفيض خارج ما نغطّيه**، ولمسةٌ
       هناك تصل يوتيوب.
       ✅ **و`pointer-events: none` تُغلق البابَ من أصله**: كلُّ تحكّمنا
       يمرّ بـ`postMessage` عبر واجهة المشغّل لا بلمسِ السطح — **فلا شيءَ
       نخسره، ونكسب أنّ «لا إيقاف» صارت قاعدةً في الـDOM لا عُرفاً
       يُرجى.** (حكمُ D-771: «خلّه دائماً شغّال».) */
    frame.style.pointerEvents = "none";
    dom.ytHost.appendChild(frame);
    const rec: PlayerRec = {
      p: null,
      ready: false,
      frame,
      key: firstKey,
      preload: asActive ? "idle" : "loading",
      failedKey: null,
      played: false,
    };
    if (asActive) act = rec;
    else sby = rec;
    applyRoles();
    const yt = await loadYouTubeApi();
    if (destroyed) return;
    /* 🆕 D-766: دورُه انتهى قبل اكتمال إقلاعه (بِكرٌ هُدم في الترقية) */
    if (!rec.frame.isConnected) return;
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
          /* 🆕 D-766: أوّلُ PLAYING يختم المشغّلَ «مجرَّباً» — أيّاً كان دورُه */
          if (e.data === window.YT?.PlayerState?.PLAYING) rec.played = true;
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
            clearStall();
            stopTick();
            /* 🆕 **محاولةٌ صامتةٌ واحدةٌ قبل أن نستسلم** (D-779، بلاغُ
               أحمد: «بعض الأحيان في مقطع يجهز ولكن مايشتغل تطلع علامة
               تشغيل»).
               🔑 **والمكتومُ يُسمح له بلا إيماءة** في كلِّ المتصفّحات —
               **وأكثرُ حالات المنع سباقٌ لا رفض**: المشغّلُ جاهزٌ
               والنداءُ سبق جهوزيّتَه بأجزاءِ ثانية. **فالمحاولةُ الثانيةُ
               تنجح غالباً، والزرُّ يبقى لمن رفضه النظامُ حقّاً.**
               ⚖️ **وهذا مقتضى D-771** («خلّه دائماً شغّال»): **زرُّ
               تشغيلٍ يظهر قبل أن نحاول مرّتين نقضٌ للحكم لا تنفيذٌ له.** */
            if (rec.key && retriedKey !== rec.key && rec.p && rec.ready) {
              retriedKey = rec.key;
              setPhase("loading");
              try {
                rec.p.mute();
                rec.p.playVideo();
              } catch {
                /* مشغّلٌ مات بين الفحص والنداء — المهلةُ تكشفه */
              }
              clearRetry();
              retryTimer = window.setTimeout(() => {
                /* **ولا تُجبَر حالةُ تشغيلٍ بمؤقّت** (رابعًا/١٠): المؤقّتُ
                   يُظهر الزرَّ ولا يدّعي نجاحاً — والعقربُ وحدَه يقلبها
                   «playing» عبر `onDrewFrame`. */
                retryTimer = null;
                if (phase === "loading") setPhase("blocked");
              }, RETRY_MS);
              return;
            }
            /* الغلافُ يبقى وزرُّ تشغيلٍ واضح — لا iframe أسود (رابعًا/٧) */
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

    /* 🆕 D-762 (بلاغ أحمد «يعيده من البداية»): موضعُ آخرِ مشاهدةٍ لهذه
       البطاقة — يُستأنف فقط إن طابق المفتاحُ المحفوظُ المفتاحَ المطلوب */
    const saved = activeId ? positions.get(activeId) : undefined;
    const startAt = saved && saved.key === firstKey && saved.t > 1 ? Math.floor(saved.t) : 0;

    /* 🔴 🆕 D-766 (بلاغ ٢٨ أغسطس: «ثاني مقطع دائماً تجي علامة اللودينغ
       وبعدين مايشتغل، لازم أضغط التشغيل — واللي بعده تشتغل مباشرة»):
       أوّلُ احتياطٍ في الجلسة **بِكرٌ**: iframe أُقلع مخفيّاً، وiOS لا
       يبدأ تشغيلَ المخفيّ أبداً — فلا يبلغ PLAYING، وأمرُ playVideo
       الأوّلُ على مشغّلٍ بلا جلسةِ تشغيلٍ يُبتلع بصمت (عطبُ D-759
       الأصليّ). الترقيةُ كانت تُسلّم الظاهرَ لهذا الأخرس: دوّامةٌ ثم
       تعثّرُ ٨ ثوانٍ ثم زرّ. أمّا الثالثةُ فما بعدها فاحتياطُها المشغّلُ
       السابقُ وقد عمل ظاهراً — جلستُه قائمةٌ فيُطاع. العلاج: البِكرُ
       يُهدم ويُبنى مكانَه إطارٌ جديدٌ **ظاهراً** بمحاولته الذاتيّة
       (autoplay=1&mute=1 — بوّابةُ iOS الوحيدة، طريقُ أوّلِ بطاقةٍ
       نفسُه)، والمجرَّبُ القديمُ يصير احتياطاً فتعود الترقيةُ ممكنةً
       لكلِّ ما بعدها. يقع مرّةً في الجلسة وعلى iOS عمليّاً وحدَه —
       الحاسوبُ يشغّل المخفيَّ فيُولد الاحتياطُ مجرَّباً ولا يمرّ هنا. */
    if (sby && sby.key === firstKey && !sby.played) {
      const virgin = sby;
      sby = act; /* أوقفه activate() للتوّ — عودةٌ إليه لاحقاً ترقيةٌ دافئة */
      act = null;
      if (sby) sby.preload = "idle";
      try {
        virgin.p?.destroy();
      } catch {
        /* مشغّلٌ لم يكتمل إنشاؤه */
      }
      virgin.frame.remove();
      void bootPlayer(firstKey, true, startAt);
      return;
    }

    if (sby?.ready && sby.p && sby.key === firstKey && sby.played) {
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
      /* ⚖️ D-771: الحملُ بالنيّة وحدَها — لا شرطَ قفلٍ مفكوك */
      const carry = wantSound && !soundBlocked;
      if (carry) {
        act.p?.unMute();
        act.p?.setVolume(100);
        autoUnmuteAt = Date.now();
      } else {
        act.p?.mute();
      }
      publish({ soundOn: carry });
      act.p?.playVideo();
      /* المُرقّى عازلُه من الصفر — إن كان للبطاقة موضعٌ محفوظٌ نلحق به */
      if (startAt > 0) act.p?.seekTo(startAt, true);
      scheduleVerify(600);
      return;
    }

    if (act?.p && act.ready) {
      /* مسار D-760 كما هو: حملُ الصوت وتحميلٌ في الظاهر نفسِه
         (⚖️ D-771: بالنيّة وحدَها) */
      const carry = wantSound && !soundBlocked;
      if (carry) {
        act.p.unMute();
        act.p.setVolume(100);
        autoUnmuteAt = Date.now();
      } else {
        act.p.mute();
      }
      publish({ soundOn: carry });
      if (act.key === firstKey) {
        /* 🔴 D-762: المقطعُ نفسُه ما زال في الظاهر (اختلس نظرةً وعاد) —
           استئنافٌ من موضعه، لا إعادةُ تحميلٍ تُرجعه إلى الصفر */
        act.p.playVideo();
      } else {
        act.key = firstKey;
        act.p.loadVideoById(startAt > 0 ? { videoId: firstKey, startSeconds: startAt } : firstKey);
      }
      scheduleVerify(600);
      return;
    }

    if (act) return; /* يقلع الآن — onReady يلحق بالمفتاح المطلوب */
    void bootPlayer(firstKey, true, startAt);
  };

  /* ---- التنشيط (قلبُ المتحكّم) ---- */
  const activate = (id: string, viaGesture: boolean) => {
    const slot = slots.get(id);
    if (!slot) return;

    if (activeId === id) {
      /* بطاقةٌ نشطةٌ ضُغط زرُّها: استئنافٌ داخل الإيماءة نفسِها —
         بلا إعادةِ إنشاءِ iframe (رابعًا/٨-٩) */
      if (viaGesture) {
        /* 🆕 D-762: استئنافُ إيقافٍ مؤقّتٍ يحفظ حالَ الصوت **ولا يمرّ
           بـ«loading»** — المرورُ بها كان يُنزل الغلافَ ومضةً فوق إطارٍ
           مرسوم؛ حدثُ PLAYING يقلبها «playing» وحدَه. الكتمُ القسريُّ
           و«loading» لمسارَي الحظر والتعثّر وحدَهما */
        const resuming = phase === "paused";
        if (!resuming) {
          setPhase("loading");
          armStall();
        }
        if (activeIsFile()) {
          if (!resuming) dom.video.muted = true;
          void dom.video.play().catch(() => {
            if (activeId === id) setPhase("stalled");
          });
          startTick();
          startVeilProbe();
        } else if (act?.p && act.ready) {
          if (!resuming) act.p.mute();
          act.p.playVideo();
        }
      }
      return;
    }

    /* أوقف السابقةَ أوّلاً — لا يعمل مقطعان معاً أبداً (ثالثًا/٤) —
       وموضعُها يُقيَّد قبل مغادرتها (D-762) */
    rememberPosition();
    pauseCurrent();
    showOverlay(false);
    stopTick();
    clearStall();
    /* **والمحاولةُ تُستأنف لكلِّ بطاقةٍ جديدة** — الحدُّ لكلِّ مفتاحٍ لا
       لكلِّ جلسة (D-779) */
    retriedKey = null;
    clearRetry();
    keyIdx = 0;
    advancedFor = -1;
    /* 🆕 D-771: بطاقةٌ جديدةٌ تمحو ختمَ الرفض — محاولةُ فكٍّ واحدةٌ
       لكلِّ بطاقةٍ كحدٍّ أقصى، لا حلقةٌ ولا صمتٌ دائم */
    soundBlocked = false;
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
         (⚖️ D-771: بالنيّة وحدَها — لا شرطَ قفلٍ مفكوك) */
      const carry = wantSound && !soundBlocked;
      dom.video.muted = !carry;
      if (carry) dom.video.volume = 1;
      publish({ soundOn: carry });
      /* فيديو جديد: صفّر الزمنَ — إلا موضعاً محفوظاً لهذه البطاقة نفسِها
         فيُستأنف (D-762، بلاغ «يعيده من البداية») */
      const savedFile = positions.get(id);
      dom.video.currentTime =
        savedFile && savedFile.key === slot.item.fileUrl && savedFile.t > 1 ? savedFile.t : 0;
      void dom.video.play().catch(() => {
        if (activeId !== id) return;
        if (carry) {
          soundBlocked = true;
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
    const el = dom.overlay;
    /* 🆕 D-762: في التكبير المسرحيّ الطبقةُ لا تتبع البطاقة — وأيُّ
       نداءِ محاذاةٍ شاردٍ يثبّتها على الملء لا يعيدها للبطاقة.
       🔴 D-763: الصندوقُ **16:9 ممركزٌ** لا ملءُ الشاشة — قصُّ الأطراف
       يفترض فيديو بعرض الصندوق في ثلثه الأوسط، وملءُ شاشةٍ عرضيّةٍ أعرضَ
       من 16:9 كان سيقصّ من الفيديو نفسِه. السوادُ حول الصندوق ستارةُ
       المحرّك (scrim) تحت الطبقة. */
    if (expandedFlag) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let w = vw;
      let h = (vw * 9) / 16;
      if (h > vh) {
        h = vh;
        w = (vh * 16) / 9;
      }
      el.style.transform = `translate(${(vw - w) / 2}px, ${(vh - h) / 2}px)`;
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      return;
    }
    const slot = slots.get(activeId);
    if (!slot) return;
    /* قياسٌ طازجٌ في كلِّ نداء — لا قياسَ قديماً بعد لفٍّ أو تدوير */
    const r = slot.area.getBoundingClientRect();
    el.style.transform = `translate(${r.left}px, ${r.top}px)`;
    el.style.width = `${r.width}px`;
    el.style.height = `${r.height}px`;
  };

  /* التكبيرُ المسرحيّ (D-762): الطبقةُ فوق ترويسةِ الصفحة وتحت أزرارِ
     التوسعة، والتمريرُ خلفها مقفول — والتصغيرُ يعيد كلَّ شيءٍ لمكانه */
  setExpanded = (on: boolean) => {
    if (expandedFlag === on) return;
    expandedFlag = on;
    document.documentElement.style.overflow = on ? "hidden" : "";
    dom.overlay.style.zIndex = on ? "55" : "30";
    dom.overlay.style.borderRadius = on ? "0" : "14px 14px 0 0";
    /* D-763: ستارةُ السواد حول صندوق 16:9 — تحت الطبقة وفوق الصفحة */
    dom.scrim.style.display = on ? "block" : "none";
    publish({ expanded: on });
    alignOverlay();
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
      rememberPosition();
      pauseCurrent();
      stopTick();
      if (sby?.p && sby.preload === "loading") {
        sby.p.pauseVideo();
        sby.preload = "idle";
        sby.key = null;
      }
      return;
    }
    /* ⚖️ 🆕 العودة: الصوتُ يُحمَل لا يُكتم (D-771 بحكمه «دائماً الصوت
       شغال» — نقضٌ صريحٌ منه لبند ثالثًا/٧ «استئنافٌ صامتٌ دائماً»
       الذي كان جذرَ «كل شوي أحصل المقطع صامت»): الملفُّ يحمل النيّةَ
       بنفسه ويرتدّ صامتاً عند الرفض، ويوتيوبُ يستأنف صامتاً وحدثُ
       PLAYING يفكّه بمساره الموحَّد. */
    if (!activeId) return;
    if (activeIsFile()) {
      const carry = wantSound && !soundBlocked;
      dom.video.muted = !carry;
      if (carry) dom.video.volume = 1;
      publish({ soundOn: carry });
      void dom.video.play().catch(() => {
        soundBlocked = true;
        dom.video.muted = true;
        publish({ soundOn: false });
        void dom.video.play().catch(() => undefined);
      });
      /* الإخفاءُ أوقف العدّاد — وعنصرُ الملفّ بلا حدثِ PLAYING يعيد
         تدويرَه، فبدون هذا يعمل المقطعُ والعقربُ ساكنٌ والسِّترُ نازل */
      startTick();
    } else if (act?.p && act.ready) {
      act.p.mute();
      act.p.playVideo();
      publish({ soundOn: false });
    }
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
      /* الاختيارُ الصريح يحدّث النيّةَ المحمولةَ عبر البطاقات (D-760) —
         والتفاعلُ يعيد عدَّ توارِي الأزرار (D-764). والإيماءةُ تمحو
         ختمَ الرفض (D-771): يدُ القارئ أقوى من رفضٍ آليٍّ سابق */
      wantSound = wantOn;
      if (wantOn) soundBlocked = false;
      pokeControls();
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
        if (on === wantOn) writeTrailerSound(on);
      }, 200);
    },

    /* ⚖️ 🆕 «إيقاف الفيديو» أُلغي بحكمه (D-771: «تلغي خيار إيقاف الفديو
       خله دائماً شغال») — نقضٌ صريحٌ منه لطلبه في D-762. سطحُ البطاقة
       صار يُظهر الأزرارَ فقط، والإيقافُ الوحيدُ الباقي إيقافُ النظام
       (خلفيّة/قفل شاشة) واستئنافُه بزرّ التشغيل. */

    /* ⚖️ D-762: التقديمُ عاد بطلب صاحبه («تقديم وتأخير») — نقضُ حذفِ
       D-759 سابعًا. بالواجهة الرسمية وحدَها، والزمنُ يُنشر بالأمر
       فوراً والعدّادُ يصحّح بعده (كوصفة الصوت) */
    seekTo(seconds: number) {
      if (!activeId) return;
      pokeControls();
      const t = readTime();
      const total = t?.total ?? 0;
      const target = Math.max(0, total > 0 ? Math.min(seconds, total - 0.5) : seconds);
      if (activeIsFile()) dom.video.currentTime = target;
      else if (act?.p && act.ready) act.p.seekTo(target, true);
      if (t) publish({ time: { now: target, total: t.total } });
    },

    /* 🆕 D-762 («تكبير الفيديو»): تكبيرٌ مسرحيٌّ يملأ الشاشةَ داخل
       التطبيق — التكبيرُ الأصليُّ لإطارِ يوتيوب ممنوعٌ على iPhone في
       WebKit، وهذا يعمل على الأجهزة كلِّها بسلوكٍ واحد */
    toggleExpand() {
      if (!activeId && !expandedFlag) return;
      setExpanded(!expandedFlag);
      pokeControls();
    },

    /* 🆕 D-764: لمسةُ سطحٍ والأزرارُ متواريةٌ = أظهِرها ولا توقف */
    pokeControls() {
      pokeControls();
    },

    destroy() {
      /* لا timers ولا observers بعد unmount (اختبار ١٦) — وقفلُ التمرير
         والستارةُ يُفكّان مهما كانت الحال (D-762/D-763) */
      document.documentElement.style.overflow = "";
      dom.scrim.style.display = "none";
      destroyed = true;
      if (verifyTimer !== null) {
        window.clearTimeout(verifyTimer);
        verifyTimer = null;
      }
      stopVeilProbe();
      clearControlsTimer();
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

/** نصوصُ طبقة التكبير المسرحيّ (D-762) — تمرُّ من السطح الذي يملك القاموس */
export interface TrailerExpandedLabels {
  play: string;
  mute: string;
  unmute: string;
  collapse: string;
  seek: string;
}

export function TrailerPlayback({
  children,
  soundPref,
  expandedLabels,
}: {
  children: React.ReactNode;
  /** آخرُ اختيارٍ محفوظٍ للصوت — **يُحاوَل بعد أوّل تفاعلٍ حقيقيٍّ فقط** */
  soundPref: boolean;
  /** 🆕 D-762: سطحٌ بلا هذه النصوص لا يعرض زرَّ تكبيرٍ أصلاً (الرايل) */
  expandedLabels?: TrailerExpandedLabels;
}) {
  const snapRef = useRef<ControllerSnapshot>({
    activeId: null,
    phase: "idle",
    soundOn: false,
    time: null,
    manualOnly: false,
    expanded: false,
    controlsVisible: true,
  });
  const subsRef = useRef(new Set<() => void>());
  const engineRef = useRef<Engine | null>(null);
  const soundPrefRef = useRef(soundPref);
  const overlay = useRef<HTMLDivElement>(null);
  const ytHost = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
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
    const scrimEl = scrim.current;
    if (!overlayEl || !ytHostEl || !videoEl || !scrimEl) {
      return () => {
        LIVE_CONTROLLERS -= 1;
      };
    }

    const engine = createEngine(
      { overlay: overlayEl, ytHost: ytHostEl, video: videoEl, scrim: scrimEl },
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
  const seekTo = useCallback((seconds: number) => {
    engineRef.current?.seekTo(seconds);
  }, []);
  const toggleExpand = useCallback(() => {
    engineRef.current?.toggleExpand();
  }, []);
  const pokeControls = useCallback(() => {
    engineRef.current?.pokeControls();
  }, []);
  const subscribe = useCallback((cb: () => void) => {
    subsRef.current.add(cb);
    return () => {
      subsRef.current.delete(cb);
    };
  }, []);
  const getSnapshot = useCallback(() => snapRef.current, []);

  const api = useMemo<ControllerApi>(
    () => ({
      register,
      registerUnavailable,
      tapPlay,
      tapSound,
      seekTo,
      toggleExpand,
      pokeControls,
      subscribe,
      getSnapshot,
    }),
    [
      register,
      registerUnavailable,
      tapPlay,
      tapSound,
      seekTo,
      toggleExpand,
      pokeControls,
      subscribe,
      getSnapshot,
    ],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      {/* D-763: ستارةُ سوادِ التكبير — تحت الطبقة (55) وفوق الصفحة */}
      <div ref={scrim} className="fixed inset-0 z-[51] hidden bg-black" aria-hidden />
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
      {expandedLabels ? <ExpandedUi api={api} labels={expandedLabels} /> : null}
    </Ctx.Provider>
  );
}

/* ===== أدواتُ التحكّم (D-762) ===== */

/** عقربُ الساعة نصّاً — وصفةٌ واحدةٌ للبطاقة وطبقةِ التكبير (القاعدة ٣) */
export function clockText(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * 🆕 **مؤشّرُ التحميل الدائريّ** (D-764، طلب أحمد: «مايحسبه معلّق أو
 * خربان») — يظهر أثناء «loading» وحدَها، **وبتأخيرِ ٣٥٠م.ث** كي لا
 * يومض على الترقيات اللحظيّة؛ التعثّرُ (٨ ثوانٍ) له زرُّه لا مؤشّر.
 */
export function TrailerSpinner({ active }: { active: boolean }) {
  const [show, setShow] = useState(false);
  const activeRef = useRef(active);
  useEffect(() => {
    /* لا setState متزامناً داخل الأثر (قاعدة المُجمِّع) — الكتابةُ في
       المهلة وحدَها، والعرضُ محكومٌ بـ`active` مباشرةً */
    activeRef.current = active;
    if (!active) return;
    const t = window.setTimeout(() => {
      if (activeRef.current) setShow(true);
    }, 350);
    return () => window.clearTimeout(t);
  }, [active]);
  if (!active || !show) return null;
  return (
    <span className="pointer-events-none absolute inset-0 z-50 grid place-items-center">
      <span className="h-10 w-10 animate-spin rounded-full border-[2.5px] border-white/25 border-t-white/90" />
    </span>
  );
}

/**
 * ⚖️ **شريطُ التقديم عاد بطلب أحمد** («تقديم وتأخير» — نقضُ حذفِ D-759
 * سابعًا). سحبٌ ولمسٌ بأحداث المؤشّر مع أسرِها، و`touch-action: none`
 * كي لا يخطف تمريرُ الصفحة السحبةَ — والقيمةُ لا تُرسل إلا عند الإفلات.
 */
export function TrailerScrubber({
  time,
  onSeek,
  label,
  active = true,
}: {
  time: { now: number; total: number };
  onSeek: (seconds: number) => void;
  label: string;
  /** D-764: شريطٌ متوارٍ لا يلتقط اللمس — كي لا يُقدِّم من لا يراه */
  active?: boolean;
}) {
  const [dragPct, setDragPct] = useState<number | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  const pctOf = (clientX: number) => {
    const r = bar.current?.getBoundingClientRect();
    if (!r || r.width === 0) return 0;
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  };
  const pct = dragPct ?? (time.total > 0 ? time.now / time.total : 0);
  return (
    <div
      ref={bar}
      dir="ltr"
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(time.total)}
      aria-valuenow={Math.round(pct * time.total)}
      className={`${active ? "pointer-events-auto" : "pointer-events-none"} flex h-7 cursor-pointer items-center`}
      style={{ touchAction: "none" }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragPct(pctOf(e.clientX));
      }}
      onPointerMove={(e) => {
        if (dragPct !== null) setDragPct(pctOf(e.clientX));
      }}
      onPointerUp={(e) => {
        if (dragPct === null) return;
        onSeek(pctOf(e.clientX) * time.total);
        setDragPct(null);
      }}
      onPointerCancel={() => setDragPct(null)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") onSeek(Math.min(time.total - 1, time.now + 5));
        else if (e.key === "ArrowLeft") onSeek(Math.max(0, time.now - 5));
      }}
    >
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/25">
        <div className="absolute inset-y-0 left-0 bg-white" style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}

/**
 * 🆕 **طبقةُ التكبير المسرحيّ** (D-762، «تكبير الفيديو») — فوق طبقةِ
 * المشغّل (٥٥) بأزرارها (٦٠): سطحُ إيقافٍ/استئناف، إغلاقٌ وصوتٌ،
 * وشريطُ تقديمٍ ووقت. **التكبيرُ الأصليُّ لإطار يوتيوب ممنوعٌ على
 * iPhone في WebKit** — فهذا يملأ الشاشةَ داخل التطبيق، والتدويرُ يعطي
 * العرضيّ.
 */
function ExpandedUi({ api, labels }: { api: ControllerApi; labels: TrailerExpandedLabels }) {
  const snap = useSyncExternalStore(api.subscribe, api.getSnapshot, api.getSnapshot);
  if (!snap.expanded) return null;
  const playing = snap.phase === "playing";
  const controls = snap.controlsVisible;
  /* D-764: أزرارٌ تتوارى بعد ٥ ثوانِ تشغيل — والفئةُ واحدةٌ للثلاثة والشريط */
  const fade = `transition-opacity duration-300 ${controls ? "opacity-100" : "pointer-events-none opacity-0"}`;
  const showsPlay =
    snap.phase === "paused" || snap.phase === "blocked" || snap.phase === "stalled";
  return (
    <div className="fixed inset-0 z-[60]">
      {/* ⚖️ D-771 (حكمه: «خله دائماً شغال»): السطحُ يُظهر الأزرارَ فقط —
          الإيقافُ أُلغي، والتشغيلُ لواقفةِ النظام وحدَها */}
      <button
        type="button"
        aria-label={labels.play}
        aria-hidden={playing && !showsPlay}
        tabIndex={showsPlay ? 0 : -1}
        onClick={() => {
          if (playing) {
            api.pokeControls();
          } else if (snap.activeId) {
            api.tapPlay(snap.activeId);
          }
        }}
        className="absolute inset-0"
      >
        {showsPlay ? (
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-sm">
            <Icon name="play" size={30} />
          </span>
        ) : null}
      </button>
      <TrailerSpinner active={snap.phase === "loading"} />
      <button
        type="button"
        aria-label={labels.collapse}
        onClick={() => api.toggleExpand()}
        className={`absolute start-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 grid h-10 w-10 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm active:opacity-70 ${fade}`}
      >
        <Icon name="close" size={19} />
      </button>
      <button
        type="button"
        aria-label={snap.soundOn ? labels.mute : labels.unmute}
        onClick={() => api.tapSound()}
        className={`absolute end-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 grid h-10 w-10 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm active:opacity-70 ${fade}`}
      >
        <Icon name={snap.soundOn ? "volume" : "volume-off"} size={18} />
      </button>
      {snap.time ? (
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 to-transparent px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-8 ${fade}`}
        >
          <TrailerScrubber
            time={snap.time}
            onSeek={api.seekTo}
            label={labels.seek}
            active={controls}
          />
          <span dir="ltr" className="block text-12 tabular-nums text-white/90">
            {clockText(snap.time.now)} / {clockText(snap.time.total)}
          </span>
        </div>
      ) : null}
    </div>
  );
}
