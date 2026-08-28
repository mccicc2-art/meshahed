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
  let player: YTPlayer | null = null;
  let playerReady = false;
  let pendingLoadKey: string | null = null;
  let tick: number | null = null;
  let stall: number | null = null;
  let raf: number | null = null;
  let activeId: string | null = null;
  let phase: SlotPhase = "idle";
  let keyIdx = 0;
  let advancedFor = -1;
  let prefAttempted = false;
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

  /* ---- العدّاد: interval واحدٌ لا غير (المواصفة سادسًا/٧) ---- */
  const stopTick = () => {
    if (tick !== null) {
      window.clearInterval(tick);
      tick = null;
    }
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
    if (!player || !playerReady) return null;
    const total = player.getDuration();
    /* لا وقتَ يُعرض إلا بقيمٍ رسميةٍ منتهيةٍ موجبة (المواصفة سادسًا/٥) */
    return Number.isFinite(total) && total > 0 ? { now: player.getCurrentTime(), total } : null;
  };

  /* ---- الصوت: حقيقةٌ تُقرأ (المواصفة خامسًا) ---- */
  const verifySound = (): boolean => {
    let on = false;
    if (activeIsFile()) on = !dom.video.muted;
    else if (player && playerReady) on = !player.isMuted() && player.getVolume() > 0;
    publish({ soundOn: on });
    return on;
  };

  /** 🔴 تفضيلُ «صوت» المحفوظ يُطبَّق **داخل إيماءةٍ حقيقيّةٍ فقط**
      (يستدعيه `tapPlay` بعد أمرِ التشغيل) — كان يُحاوَل من مؤقّتِ أوّلِ
      إطار، وفكُّ الكتم خارج الإيماءة على iOS **يوقف** فيديو بدأ صامتاً
      بدل أن يُسمِعه. لا يدخل مسارَ التشغيل التلقائيّ إطلاقاً. */
  const applySavedSoundInGesture = () => {
    if (prefAttempted || !getSoundPref()) return;
    prefAttempted = true;
    if (activeIsFile()) dom.video.muted = false;
    else if (player && playerReady) {
      player.unMute();
      player.setVolume(100);
    }
    window.setTimeout(() => {
      if (!destroyed) verifySound();
    }, 250);
  };

  const onDrewFrame = () => {
    clearStall();
    setPhase("playing");
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
    else if (player && playerReady) player.pauseVideo();
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
      player?.mute();
      player?.loadVideoById(slot.item.keys[next]);
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

  const ensurePlayer = async (firstKey: string) => {
    const yt = await loadYouTubeApi();
    if (destroyed) return;
    if (player) {
      player.mute();
      verifySound();
      player.loadVideoById(firstKey);
      return;
    }
    pendingLoadKey = firstKey;
    /* 🔴 ⚖️ نقضُ «autoplay:0 + playVideo من onReady» بعد فشل iPhone الفعليّ
       (بلاغ أحمد ٢٨ أغسطس): نداءُ playVideo بلا إيماءةٍ يبتلعه iOS بصمتٍ —
       لا PLAYING ولا حتى onAutoplayBlocked، **فالحدث لا يُطلقه إلا منعُ
       محاولةِ المشغّل نفسِه**. فالإطارُ يُبنى يدويّاً بمحاولةٍ ذاتيّةٍ
       صامتة (`autoplay=1&mute=1`)، وهو الاستعمالُ الموثَّق لتسليم إطارٍ
       قائمٍ إلى `YT.Player`.
       ⚠️ و`allow="autoplay"` هو جسرُ الإيماءة: بدونه ضغطةُ زرِّنا لا
       تملك تشغيلَ فيديو داخل إطارٍ من أصلٍ آخر على iOS إطلاقاً. */
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
    player = new yt.Player(frame, {
      events: {
        onReady: () => {
          playerReady = true;
          /* بالترتيب الذي أملاه أحمد: كتمٌ ثم صفرُ صوتٍ ثم تشغيل —
             التشغيلُ التلقائيُّ صامتٌ دائماً ولا ينتظر تفضيلَ الصوت */
          player?.mute();
          player?.setVolume(0);
          verifySound();
          if (pendingLoadKey && activeId) player?.playVideo();
          pendingLoadKey = null;
        },
        onStateChange: (e) => {
          const yts = window.YT?.PlayerState;
          if (!yts) return;
          if (e.data === yts.PLAYING) {
            startTick();
            return;
          }
          if (e.data === yts.PAUSED || e.data === yts.ENDED) {
            stopTick();
            publish({ time: readTime() });
            if (activeId && phase === "playing") setPhase("paused");
          }
        },
        onError: onPlayerError,
        onAutoplayBlocked: () => {
          /* الغلافُ يبقى وزرُّ تشغيلٍ واضح — لا iframe أسود (رابعًا/٧) */
          clearStall();
          stopTick();
          setPhase("blocked");
        },
      },
    });
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
        } else if (player && playerReady) {
          /* زرُّ التشغيل يبدأ صامتاً دائماً (حالة الواجهة ٣) — والصوتُ
             لزرِّ الصوت بعد أن تتحرّك الصورة */
          player.mute();
          player.playVideo();
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
      if (player && playerReady) player.pauseVideo();
      dom.video.style.display = "";
      if (!slot.item.fileUrl) return;
      if (dom.video.src !== slot.item.fileUrl) dom.video.src = slot.item.fileUrl;
      dom.video.muted = true;
      verifySound();
      /* فيديو جديد: صفّر الزمنَ ولا تعرض مدةَ سابقه (سادسًا/٨) */
      dom.video.currentTime = 0;
      void dom.video.play().catch(() => {
        if (activeId === id) setPhase(viaGesture ? "stalled" : "blocked");
      });
      startTick();
      return;
    }

    dom.video.pause();
    /* بطاقةُ يوتيوب: آخرُ إطارِ ملفٍّ لا يفترش فوق الإطار الرسميّ */
    dom.video.style.display = "none";
    void ensurePlayer(slot.item.keys[0]);
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
      /* الخلفيّة: إيقافٌ فوريٌّ وعدّادٌ ساكن (ثالثًا/٦، سادسًا/٦) */
      pauseCurrent();
      stopTick();
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
    } else if (player && playerReady) {
      player.mute();
      player.playVideo();
    }
    verifySound();
  };

  return {
    start() {
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
      /* تفضيلُ الصوت المحفوظ: هنا فقط — داخل إيماءةٍ حقيقيّةٍ وبعد
         أمرِ التشغيل، ولا يدخل مسارَ التشغيل التلقائيّ أبداً */
      applySavedSoundInGesture();
    },

    /* 🔴 زرُّ الصوت **لا يشغّل شيئاً** (بلاغ iPhone: صار هو زرَّ التشغيل
       فعليّاً لأنّ إيماءتَه كانت تحمل playVideo). التشغيلُ لزرِّ التشغيل
       وحدَه — وهذا يبدّل الصوتَ فقط على مشغّلٍ جاهز. */
    tapSound() {
      prefAttempted = true;
      const slot = activeSlot();
      if (!slot) return;
      const wantOn = !readSnap().soundOn;
      if (activeIsFile()) {
        dom.video.muted = !wantOn;
        if (wantOn) dom.video.volume = 1;
      } else if (player && playerReady) {
        if (wantOn) {
          /* داخل الضغطة نفسِها: unMute + volume (خامسًا/٢) — بلا play */
          player.unMute();
          player.setVolume(100);
        } else {
          player.mute();
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

    destroy() {
      /* لا timers ولا observers بعد unmount (اختبار ١٦) */
      destroyed = true;
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
      try {
        player?.destroy();
      } catch {
        /* مشغّلٌ لم يكتمل إنشاؤه */
      }
      player = null;
      playerReady = false;
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
