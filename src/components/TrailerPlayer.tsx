"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { setPlaybackActive } from "@/lib/playback";

/**
 * 🆕 **مشغّلُ مقطعٍ واحد** (D-726) — **قلبُ الميزة كلِّها.**
 *
 * 🔴 **والحقيقةُ التي تحكم كلَّ سطرٍ هنا: TMDB لا يخزّن ملفَّ فيديو بل
 * مفتاحَ يوتيوب.** فلا `<video>` ولا تحكّمٌ أصيل — **والمشغّلُ إطارٌ
 * يحمل صفحةَ يوتيوب كاملة.** وثلاثةُ قراراتٍ تنبع منها:
 *
 * **١) صفرُ بايتٍ من جافاسكربت يوتيوب** — `iframe_api` ~ميغابايت،
 * **و`enablejsapi=1` وحدَها تكفي**: الأوامرُ `postMessage` إلى
 * `contentWindow`، والحالةُ تعود في `infoDelivery`.
 * ⚠️ **و`infoDelivery` غيرُ موثَّقة**: شريطُ التقدّم يظهر إن وصلت
 * ويغيب إن لم تصل — **ولا يُبنى عليها وعدٌ** (D-217).
 *
 * **٢) الإطارُ لا يُركَّب حتى يُطلب التشغيلُ فعلاً** — انظر «سياسةَ
 * التركيب» عند `activate` (D-756).
 *
 * **٣) حارسُ الواحديّة سجلٌّ على مستوى الوحدة لا حالةٌ في مكوّن**:
 * **الرايلُ والصفحةُ الكاملةُ شجرتان مختلفتان** — **ومن حرس «مشغّلٌ
 * واحد» داخل قائمةٍ سمع صوتين حين يفتح القارئُ الصفحةَ والرايلُ خلفه
 * حيّ** (D-726).
 *
 * ⚠️ **وهذا الملفُّ أُعيدت كتابتُه في D-751 بلا سجلٍّ ولا تعليق**، **فعاد
 * توثيقُه في D-756 مع إصلاح أربعة نقوضٍ صامتةٍ وقعت فيه** — **وشيفرةٌ
 * بلا حجّةٍ تُنقض بلا أن يعلم ناقضُها.**
 */

const YT_ORIGIN = "https://www.youtube-nocookie.com";

/**
 * 🔴 **عتبةُ البدء ٠٫٤ لا ٠٫٦** (D-743، **أُعيدت في D-756 بعد أن نُقضت
 * صامتةً في D-751**): **يوتيوب يحتاج ثوانيَ قبل أوّل إطار** — **والبدءُ
 * حين تصير البطاقةُ مرئيّةً بالكامل بدءٌ متأخّرٌ بثوانٍ يراها القارئُ
 * بطئاً.**
 * 🔑 **وحدٌّ واحدٌ لفعلٍ وضدِّه يجعل الحافّةَ مفتاحاً يرتجف** — **فمن
 * أراد سكوناً فليُبعد حدَّ الرجوع عن حدِّ الذهاب**: يشتغل عند ٠٫٤
 * ويصمت تحت ٠٫١٥، ولا شيءَ بينهما.
 */
const START_RATIO = 0.4;
const STOP_RATIO = 0.15;

/**
 * 🔑 **والدورُ لأوضحِ من يُرى لا لآخرِ من عبَر الحدّ** (D-744): **قادمٌ
 * لا ينتزع الدورَ إلّا إن كان أظهرَ من صاحبِه بفارقٍ معتبر** — **وإلّا
 * قرّر ترتيبُ نداءات المراقب، لا عينُ القارئ، أيُّهما يعمل.**
 */
const SWITCH_GAP = 0.05;

/**
 * **مهلةُ عرض الزرّ** (D-729، وحُصر أثرُها في D-756): **أطولُ من كلِّ
 * تخزينٍ معقول** — وبعدها يُعرض مخرجٌ للقارئ **ولا يُمسّ المقطع.**
 * 🔑 **وهي مهلةُ عرضٍ لا مهلةُ حكم**: **أقصرُ من نافذة المصافحة عمداً**
 * — **لأنّ ما تفعله غيرُ قابلٍ للضرر**: زرٌّ يظهر ويغيب من نفسه بأوّل
 * عقربٍ يتحرّك. **ولو كانت تحكم بالموت لوجب أن تنتظر آخرَ الطارقين.**
 */
const BELT_MS = 9000;

/**
 * **وسقفُ المصافحة يمتدّ ما دام الإطارُ مركَّباً** (D-756): **إطارُ
 * يوتيوب قد يفرغ من التحميل بعد عشر ثوانٍ على شبكةٍ بطيئة** — **ومن
 * كفَّ عن النداء قبلها لا يسمع الإطارَ حين يستيقظ**، **فلا يبلغه أمرُ
 * الإيقاف** (`autoplay=1` في رابطه) **فيعمل مقطعان معاً.**
 * ⚠️ **والثمنُ رسالةٌ في الصفحة نفسِها كلَّ ٤٠٠م.ث** — لا رحلةَ شبكة.
 */
const HELLO_TRIES = 60;

const VISIBILITY_THRESHOLDS = Array.from({ length: 21 }, (_, i) => i / 20);

type PlayerRegistration = {
  ratio: number;
  activate: () => void;
  deactivate: () => void;
};

const PLAYERS = new Map<symbol, PlayerRegistration>();
let ACTIVE: symbol | null = null;

function setActive(next: symbol | null) {
  if (ACTIVE === next) return;
  if (ACTIVE) PLAYERS.get(ACTIVE)?.deactivate();
  ACTIVE = next;
  if (next) PLAYERS.get(next)?.activate();
}

/** **والمزاحمةُ تُحسم بالنسبة لا بترتيب الوصول** (D-744) */
function reconcilePlayers() {
  let bestId: symbol | null = null;
  let bestRatio = 0;
  for (const [id, player] of PLAYERS) {
    if (player.ratio > bestRatio) {
      bestId = id;
      bestRatio = player.ratio;
    }
  }

  const current = ACTIVE ? PLAYERS.get(ACTIVE) : null;
  if (current && current.ratio >= STOP_RATIO) {
    if (
      bestId &&
      bestId !== ACTIVE &&
      bestRatio >= START_RATIO &&
      bestRatio > current.ratio + SWITCH_GAP
    ) {
      setActive(bestId);
    }
    return;
  }

  if (bestId && bestRatio >= START_RATIO) setActive(bestId);
  else setActive(null);
}

function registerPlayer(id: symbol, player: Omit<PlayerRegistration, "ratio">) {
  PLAYERS.set(id, { ...player, ratio: 0 });
}

function updatePlayerRatio(id: symbol, ratio: number) {
  const player = PLAYERS.get(id);
  if (!player) return;
  player.ratio = ratio;
  reconcilePlayers();
}

function unregisterPlayer(id: symbol) {
  const wasActive = ACTIVE === id;
  PLAYERS.delete(id);
  if (wasActive) ACTIVE = null;
  reconcilePlayers();
}

/**
 * **وضغطةُ الإصبع تعلو على كلِّ نسبة** — من ضغط أراد هذا لا الأظهر.
 * 🔴 ⚠️ **والدورُ يُؤخَذ بنسبةٍ تُكتب معه** (D-756): **من أخذ الدورَ
 * بإصبعه ونسبتُه صفرٌ في السجلّ يُنتزع منه عند أوّل مصالحة** — **وفي
 * وضع موفّر البيانات لا مراقبَ يرفعها أبداً**، **فكان أيُّ مشغّلٍ
 * يُفكَّك في الصفحة يُسكت ما شغّله القارئُ بيده.**
 */
function manuallyActivate(id: symbol, resume: () => void) {
  const player = PLAYERS.get(id);
  if (!player) return;
  if (ACTIVE && ACTIVE !== id) PLAYERS.get(ACTIVE)?.deactivate();
  ACTIVE = id;
  player.ratio = Math.max(player.ratio, START_RATIO);
  resume();
}

function isSaving(): boolean {
  try {
    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }
    ).connection;
    return Boolean(connection?.saveData) || Boolean(connection?.effectiveType?.includes("2g"));
  } catch {
    return false;
  }
}

function clock(sec: number): string {
  const seconds = Math.max(0, Math.floor(sec));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

type PlayerInfo = {
  currentTime?: number;
  duration?: number;
  playerState?: number;
  errorCode?: number;
};

type PlayerMessage = {
  event?: string;
  info?: number | PlayerInfo;
};

export function TrailerPlayer({
  videoKey,
  videoKeys,
  backdrop,
  title,
  muted,
  onMutedChange,
  playLabel,
  muteLabel,
  unmuteLabel,
  seekLabel,
  className = "",
  eager = false,
  href,
  openLabel,
  onOpen,
  onUnavailable,
}: {
  videoKey: string;
  videoKeys?: string[];
  backdrop: string | null;
  title: string;
  muted: boolean;
  onMutedChange: (next: boolean) => void;
  playLabel: string;
  muteLabel: string;
  unmuteLabel: string;
  seekLabel?: string;
  className?: string;
  /** **البطاقةُ الأولى فوق الطيّة** (D-756): صورتُها تُحمَّل بأولويّة */
  eager?: boolean;
  href?: string;
  openLabel?: string;
  onOpen?: () => void;
  onUnavailable?: () => void;
}) {
  const id = useRef<symbol | null>(null);
  if (id.current === null) id.current = Symbol("trailer");
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const activeRef = useRef(false);
  /** **هل الإطارُ مركَّبٌ الآن؟** — الحالةُ لا تُقرأ داخل نداء المراقب */
  const mountedRef = useRef(false);
  const mutedRef = useRef(muted);
  /** 🔑 **هل تكلّم الإطارُ مرّةً؟** — دليلُ الحياة الوحيد (D-744/D-730) */
  const heardRef = useRef(false);
  const playingRef = useRef(false);
  const atRef = useRef<{ now: number; total: number } | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  const unavailableRef = useRef(onUnavailable);

  const [mounted, setMounted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [manualOnly, setManualOnly] = useState(false);
  const [paused, setPaused] = useState(false);
  const [at, setAt] = useState<{ now: number; total: number } | null>(null);
  const [tryIdx, setTryIdx] = useState(0);
  const [launch, setLaunch] = useState(0);
  /**
   * 🔴 🆕 **عدّادُ محاولات التشغيل — والحزامُ يتبعه لا يتبع البناء**
   * (D-756).
   * **كان الحزامُ معلّقاً بأثرِ الإطار وحدَه**، **فمن استُؤنف بأمرٍ
   * (`playVideo`) لا ببناءٍ جديد لم يُحرسه شيء** — **وأمرٌ لم يُطَع
   * يترك البطاقةَ ساكنةً بلا زرٍّ ولا مخرج.**
   * 🔑 **والقاعدة: الحارسُ يُنصَب عند كلِّ محاولةٍ لا عند كلِّ بناء** —
   * **ومن نصبه على أحد المسارين حرس نصفَ الطريق.**
   */
  const [attempt, setAttempt] = useState(0);

  const keys = videoKeys?.length ? videoKeys : [videoKey];
  const lastKey = keys.length - 1;
  const key = keys[Math.min(tryIdx, lastKey)];
  const dead = tryIdx >= keys.length;

  const send = useCallback((func: string, args: unknown[] = []) => {
    try {
      frame.current?.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func, args }),
        YT_ORIGIN,
      );
    } catch {
      /* الإطارُ بين تحميلين — والأمرُ يُعاد عند أوّل دليلٍ على السمع */
    }
  }, []);

  /**
   * 🔴 🆕 **سياسةُ التركيب — إطارٌ واحدٌ لا اثنان** (D-756).
   *
   * **كان الإطارُ يُركَّب عند القرب بـ`autoplay=0`، ثمّ يُهدَم ويُبنى
   * ثانيةً بـ`autoplay=1` لحظةَ يأتي الدور** — **فالمشغّلُ الذي يعمل
   * فعلاً لم يستفد من التحميل المسبق شيئاً**: ملفّاتُ يوتيوب في خبيئة
   * HTTP بعد البطاقة الأولى، **وتنفيذُ `base.js` يُعاد كاملاً في كلِّ
   * إطارٍ جديد.** **فرايلٌ من ستٍّ كان يدفع حتى خمسةَ تحميلاتٍ مهدورة،
   * وصفرَ ربحٍ في زمن البدء.**
   * 🔑 **والقاعدة: ما يُشترى ثمّ يُرمى ثمنٌ بلا سلعة** — **إمّا أن يكون
   * الإطارُ المُحمَّلُ مسبقاً هو الذي يعمل، وإمّا ألّا يُحمَّل.**
   *
   * **فالتركيبُ صار عند الدور وحدَه**، **و`autoplay=1` هو المسارُ
   * المُثبَت منذ D-726 ولم يُمسّ** (D-750: مسارٌ لم يُقس لا يُوضع حيث
   * يقع الحملُ الغالب).
   * ⚠️ **ومن كان إطارُه حيّاً وقد تكلّم يُستأنف بأمرٍ لا بإعادة بناء** —
   * **وإعادةُ بناءِ ما هو محمَّلٌ تبدأ من ٠:٠٠ وتدفع التحميلَ ثانيةً.**
   */
  const activate = useCallback(() => {
    activeRef.current = true;
    setPlaying(false);
    setPaused(false);
    setAttempt((value) => value + 1);
    /* ⚠️ **والسؤالُ يُوجَّه إلى مرجعٍ لا إلى حالة**: **حالةُ التركيب
       تتأخّر عن نداء المراقب بدورة رسم** — **ومن قرأها هناك قرأ ماضياً
       فأمَرَ إطاراً على وشك الهدم.** */
    if (mountedRef.current && frame.current) {
      /* إطارٌ قائم: إن تكلّم فهو يسمع فيُؤمَر، وإن لم يتكلّم بعدُ
         فـ`autoplay=1` في رابطه يتكفّل به حين يفرغ من التحميل. */
      if (heardRef.current) {
        send(mutedRef.current ? "mute" : "unMute");
        send("playVideo");
      }
      return;
    }
    mountedRef.current = true;
    setMounted(true);
    setLaunch((value) => value + 1);
  }, [send]);

  const deactivate = useCallback(() => {
    activeRef.current = false;
    send("pauseVideo");
    setPlaying(false);
    setPaused(false);
  }, [send]);

  const resumeManually = useCallback(() => {
    activeRef.current = true;
    setPlaying(false);
    setPaused(false);
    setAttempt((value) => value + 1);
    if (mountedRef.current && frame.current && heardRef.current) {
      send(mutedRef.current ? "mute" : "unMute");
      send("playVideo");
      return;
    }
    /* **وإطارٌ لا يتكلّم لا يُؤمَر، يُعاد بناؤه** — وهو مسارُ النجاة الوحيد */
    mountedRef.current = true;
    setMounted(true);
    setLaunch((value) => value + 1);
  }, [send]);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    atRef.current = at;
  }, [at]);

  useEffect(() => {
    unavailableRef.current = onUnavailable;
  }, [onUnavailable]);

  useEffect(() => {
    const playerId = id.current;
    if (!playerId) return;
    registerPlayer(playerId, { activate, deactivate });
    const element = box.current;
    if (!element) return () => unregisterPlayer(playerId);

    const requiresTap = typeof IntersectionObserver === "undefined" || isSaving();
    if (requiresTap) {
      /* **وموفّرُ البيانات لا يُشغَّل له شيءٌ بلا لمسة** — **والخروجُ من
         الشاشة يُسكت ما شغّله بإصبعه** (D-752). */
      const timer = window.setTimeout(() => setManualOnly(true), 0);
      const visibilityObserver =
        typeof IntersectionObserver === "undefined"
          ? null
          : new IntersectionObserver(
              ([entry]) => {
                if (entry.intersectionRatio >= STOP_RATIO) return;
                /* 🔴 **والنسبةُ تُطفأ مع الدور** (D-756): **في هذا الوضع لا
                   مراقبَ يُحدّث السجلّ أبداً** — **فنسبةٌ رفعتها الضغطةُ
                   وبقيت ترشّح البطاقةَ للدور إلى الأبد**، **فيُبعثها أوّلُ
                   مشغّلٍ يُفكَّك في الصفحة وهي خارجَ الشاشة** (D-752). */
                const player = PLAYERS.get(playerId);
                if (player) player.ratio = 0;
                if (ACTIVE === playerId) setActive(null);
              },
              { threshold: [0, STOP_RATIO] },
            );
      visibilityObserver?.observe(element);
      return () => {
        window.clearTimeout(timer);
        visibilityObserver?.disconnect();
        unregisterPlayer(playerId);
      };
    }

    /**
     * ⚠️ **ومراقبُ الجوار مهمّتُه الهدمُ لا البناء** (D-756): **إطارٌ
     * موقوفٌ ليس إطاراً مُفكَّكاً — يبقى صفحةَ يوتيوب حيّةً في الذاكرة**
     * (D-728) — **فما ابتعد أكثرَ من ٤٢٠px يُفكَّك، وما اقترب لا يُركَّب
     * حتى يأتيه الدور.**
     */
    const keepObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) return;
        updatePlayerRatio(playerId, 0);
        heardRef.current = false;
        mountedRef.current = false;
        setMounted(false);
        setAt(null);
        setPaused(false);
        /* ⚠️ **وعدّادُ البناء يصعد ولا يُصفَّر**: **مفتاحٌ يعود إلى قيمةٍ
           سابقةٍ يُعيد استعمالَ العنصر بدل بنائه** — **فيُقرأ إطارٌ ميّتٌ
           إطاراً جديداً.** */
      },
      { rootMargin: "420px 0px" },
    );

    const visibilityObserver = new IntersectionObserver(
      ([entry]) => updatePlayerRatio(playerId, entry.intersectionRatio),
      { threshold: VISIBILITY_THRESHOLDS },
    );

    keepObserver.observe(element);
    visibilityObserver.observe(element);
    return () => {
      keepObserver.disconnect();
      visibilityObserver.disconnect();
      unregisterPlayer(playerId);
    };
  }, [activate, deactivate]);

  /**
   * 🔴 🆕 **العودةُ من الخلفيّة تستأنف ولا تُعيد التحميل** (D-730،
   * **أُعيدت في D-756**): **كان الرجوعُ يرفع عدّادَ البناء فيُهدَم
   * الإطارُ ويبدأ المقطعُ من ٠:٠٠ ويُدفع تحميلٌ ثانٍ** — **ومن خرج
   * لحظةً وعاد فقد موضعَه.**
   * ⚠️ **والصوتُ يُعاد تأكيدُه لا يُفترض بقاؤه**: **النظامُ قد يُسكت
   * الإطارَ وهو في الخلفيّة** — **وتفضيلٌ محفوظٌ لا يُنفَّذ تفضيلٌ لم
   * يُطبَّق.**
   * ⚠️ **وإطارٌ لم يتكلّم قطُّ لا يُؤمَر بل يُعاد بناؤه** (D-730):
   * **أمرٌ إلى نافذةٍ لم تُحمَّل يُبتلع صامتاً.**
   */
  useEffect(() => {
    const onVisibility = () => {
      if (!activeRef.current) return;
      if (document.visibilityState === "hidden") {
        send("pauseVideo");
        setPlaying(false);
        return;
      }
      /* ⚠️ **والحالةُ تُنظَّف قبل الفرع لا داخل أحدِ طرفيه** (D-756):
         **مسارُ الأمر كان يعود قبل التنظيف** — **فيبقى زرُّ التشغيل
         مرسوماً فوق مقطعٍ استُؤنف.** */
      setPlaying(false);
      setPaused(false);
      setAttempt((value) => value + 1);
      if (mountedRef.current && frame.current && heardRef.current) {
        send(mutedRef.current ? "mute" : "unMute");
        send("playVideo");
        return;
      }
      mountedRef.current = true;
      setMounted(true);
      setLaunch((value) => value + 1);
    };
    const onPageHide = () => send("pauseVideo");
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [send]);

  useEffect(() => {
    if (!mounted || dead) return;
    /* 🔴 **وكلُّ تشغيلٍ لهذا الأثر يعني إطاراً جديداً** (مفتاحٌ تبدّل أو
       بناءٌ أُعيد) — **فدليلُ السمع يُصفَّر معه**: **إطارٌ جديدٌ يرث
       شهادةَ سلفِه يُؤمَر قبل أن يُحمَّل، والأمرُ يُبتلع صامتاً**
       (D-730). */
    heardRef.current = false;
    let heard = false;
    let failed = false;

    function onMessage(event: MessageEvent) {
      if (event.origin !== YT_ORIGIN || event.source !== frame.current?.contentWindow) return;
      let data: PlayerMessage;
      try {
        data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }

      const info = typeof data.info === "object" && data.info ? data.info : null;
      /* **والحجبُ البلديُّ لا يُتوقّع، يُكتشف** (D-743): الخطأُ يُقدّم إلى
         البديل التالي، **ولا رسالةَ اعتذارٍ في صفٍّ يُمرَّر** (D-217). */
      if (data.event === "onError" || typeof info?.errorCode === "number") {
        if (failed) return;
        failed = true;
        setPlaying(false);
        setAt(null);
        /* 🔴 ⚠️ **ومن لا دورَ له لا يُبنى له إطارٌ جديد** (D-756):
           **البديلُ يُركَّب بـ`autoplay=1` فيعمل مقطعان معاً** — **وخطأٌ
           يصل مشغّلاً خارجَ الدور يُطوى إطارُه ويُؤجَّل بديلُه إلى أن
           يأتيه دورُه.** */
        if (!activeRef.current) {
          mountedRef.current = false;
          setMounted(false);
        }
        setTryIdx((value) => value + 1);
        return;
      }
      if (!info) return;

      /* 🔑 **وأوّلُ رسالةٍ هي أوّلُ دليلٍ على السمع** (D-730): **عندها
         تُطبَّق الحالةُ المقصودة لا قبلها** — **ومن لا دورَ له يُسكَت
         هنا**، فـ`autoplay=1` في رابطه قد يكون سبق أمرَ الإيقاف. */
      if (!heard) {
        heard = true;
        heardRef.current = true;
        if (activeRef.current) send(mutedRef.current ? "mute" : "unMute");
        else send("pauseVideo");
      }

      /* 🔑 **وأصدقُ دليلٍ على الرسم عقربٌ تحرّك** (D-729): **حالةٌ بلا
         زمنٍ نيّةٌ لا فعل.** */
      if (info.playerState === 1 && typeof info.currentTime === "number" && info.currentTime > 0.1) {
        setPlaying(true);
        setPaused(false);
      }

      if (activeRef.current && (info.playerState === 2 || info.playerState === 0)) {
        setPlaying(false);
        setPaused(true);
      }

      if (
        typeof info.currentTime === "number" &&
        typeof info.duration === "number" &&
        info.duration > 0
      ) {
        setAt({ now: info.currentTime, total: info.duration });
      }
    }

    window.addEventListener("message", onMessage);

    /* 🔑 **ومصافحةٌ لا يبدؤها أحدٌ لا تقع** (D-726): `onReady` لا تصل حتى
       نرسل «أنا مستمع» — **فالنداءُ يُكرَّر حتى يُجاب ثمّ يسكت.**
       ⚠️ **وشرطُ التوقّف هو السمعُ لا عرضُ شريطِ التقدّم** (D-756):
       **عَلَمُ عرضٍ كان يقرّر متى نكفّ عن مناداة الإطار.** */
    let tries = 0;
    const hello = window.setInterval(() => {
      if (heard || tries++ > HELLO_TRIES) {
        window.clearInterval(hello);
        return;
      }
      try {
        frame.current?.contentWindow?.postMessage(
          JSON.stringify({ event: "listening", id: key, channel: "widget" }),
          YT_ORIGIN,
        );
      } catch {
        /* المصافحةُ التالية تُعيد المحاولة بعد أن يفرغ الإطارُ من التحميل */
      }
    }, 400);

    return () => {
      window.clearInterval(hello);
      window.removeEventListener("message", onMessage);
    };
  }, [mounted, dead, key, launch, send]);

  /**
   * 🔴 🆕 **وحزامٌ يقتل ما يحرسه ليس حزاماً** (D-756 — إصلاحُ نقضٍ صامتٍ
   * وقع في D-751).
   *
   * **كان الحزامُ يرسل `pauseVideo` لكلِّ مقطعٍ لم يرسم إطاراً خلال
   * ثمانٍ** — **فمقطعٌ يُخزِّن على شبكةٍ بطيئة كنّا نوقفه بأيدينا ثمّ
   * نعرض له زرَّ تشغيل.** **وهو نقضُ D-745 حرفاً**: «الشرطُ الطاعةُ لا
   * التشغيل — ومن أعاد تحميلَ ما كان يعمل زاده بطئاً باسم إنقاذه».
   *
   * 🔑 **وحكمُه اليوم واحدٌ لا ثلاثة: لم يعمل بعد المهلة؟ يُعرض الزرّ** —
   * **ولا يُوقَف شيءٌ ولا يُهدَم إطارٌ ولا يُبدَّل مفتاح.**
   * **وهو أضعفُ تدخّلٍ يُنهي الحيرة**: **المقطعُ يبقى يُخزِّن ما شاء،
   * والصورةُ تبقى فوقه، والقارئُ يملك مخرجاً** — **وإن بدأ من نفسه
   * غاب الزرُّ بأوّل عقربٍ يتحرّك** (D-729).
   *
   * ⚠️ **ولا يُبدَّل المفتاحُ على صمت** (نقضٌ لِما كتبتُه في أوّل جولةٍ
   * اليوم): **الصمتُ عند الثانية التاسعة معناه الغالبُ إطارٌ لم يفرغ من
   * التحميل، لا مقطعٌ محجوب** — **والمحجوبُ يرسل `onError` بعد أن
   * تُقبَل مصافحتُه، وله بابُه** (D-743). **فمن بدّل المفتاحَ على صمتٍ
   * هدم تحميلاً كاد يتمّ وبدأ من الصفر، مرّةً لكلِّ بديل.**
   * 🔑 **والقاعدة: مهلةٌ تنقضي وأنت لا تزال تنادي ليست دليلَ موت** —
   * **ونافذةُ المصافحة أطولُ من الحزام عمداً** (`HELLO_TRIES`).
   *
   * ⚠️ **وهو معلَّقٌ بعدّاد المحاولات لا بأثر الإطار**: **الاستئنافُ
   * بأمرٍ لا يبني إطاراً، فما كان معلّقاً بالبناء لا يحرسه** — **وأمرٌ
   * لم يُطَع كان يترك البطاقةَ بلا زرٍّ ولا مخرج.**
   */
  useEffect(() => {
    if (!attempt || !mounted || dead) return;
    const belt = window.setTimeout(() => {
      if (!activeRef.current || playingRef.current) return;
      setPaused(true);
    }, BELT_MS);
    return () => window.clearTimeout(belt);
  }, [attempt, mounted, dead]);

  useEffect(() => {
    if (!dead) return;
    unavailableRef.current?.();
  }, [dead]);

  useEffect(() => {
    if (!mounted || !activeRef.current) return;
    send(muted ? "mute" : "unMute");
  }, [muted, mounted, send]);

  /* **وما يُقاطع القارئ يُؤجَّل إلى أن يفرغ** (D-749): الوحدةُ لا تعرف
     الترايلرَ باسمه، **وأيُّ مشغّلٍ قادمٍ يستعملها.** */
  useEffect(() => {
    playingRef.current = playing;
    const token = frame;
    setPlaybackActive(token, playing);
    return () => setPlaybackActive(token, false);
  }, [playing]);

  const seek = useCallback(
    (clientX: number) => {
      const element = bar.current;
      const total = atRef.current?.total ?? 0;
      if (!element || total <= 0) return;
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0) return;
      const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const next = fraction * total;
      send("seekTo", [next, true]);
      setAt((value) => (value ? { ...value, now: next } : value));
    },
    [send],
  );

  const nudge = useCallback(
    (seconds: number) => {
      const current = atRef.current;
      if (!current || current.total <= 0) return;
      const next = Math.min(current.total, Math.max(0, current.now + seconds));
      send("seekTo", [next, true]);
      setAt((value) => (value ? { ...value, now: next } : value));
    },
    [send],
  );

  const startManually = () => {
    const playerId = id.current;
    if (playerId) manuallyActivate(playerId, resumeManually);
  };

  /* **و`autoplay=1` دائماً** (D-756): **الإطارُ لا يُركَّب إلّا وقد صار
     له الدور** — **فلا رابطَ ساكنٌ يُبنى ثمّ يُهدَم.** */
  const src =
    mounted && !dead && typeof window !== "undefined"
      ? `${YT_ORIGIN}/embed/${encodeURIComponent(key)}?autoplay=1&mute=1&playsinline=1&controls=0&rel=0&modestbranding=1&loop=0&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`
      : null;
  const progress = at && at.total > 0 ? Math.min(100, (at.now / at.total) * 100) : 0;
  const showsPlayButton = paused || manualOnly;

  return (
    <div ref={box} className={`relative overflow-hidden bg-surface-2 ${className}`}>
      {src ? (
        <iframe
          key={`${key}:${launch}`}
          ref={frame}
          src={src}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture"
          className="absolute inset-0 h-full w-full"
          style={{ pointerEvents: "none", border: 0 }}
        />
      ) : null}

      {/* 🔑 **والتركيبُ ليس الرسم** (D-729): **السترُ لا يُرفع إلّا على
          إطارٍ رسم** — **ومن رفعه عند التركيب كشف عن فراغ.**
          🆕 **والصورةُ بأولويّةٍ للبطاقة الأولى** (D-756): **ما هو فوق
          الطيّة لا يُؤجَّل، والتأجيلُ لما يُرى الآن تأخيرٌ لا اقتصاد** —
          **وهي الصورةُ التي تُرى قبل أوّل إطارٍ وبعد كلِّ توقّف.**
          ⚠️ **و`sizes` تصف الحاويةَ لا الشاشة**: **البطاقةُ تبلغ
          ١٠٣٠px على سطح المكتب (D-755) وكان التلميحُ يقول ٧٢٠** —
          **فيُخدَم مصدرٌ أصغرُ من مكانه ويُرسم ممطوطاً.** */}
      <div
        className={`absolute inset-0 z-10 bg-surface-2 transition-opacity duration-300 ${
          playing ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        {backdrop ? (
          <Image
            src={backdrop}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1080px) 92vw, 1030px"
            className="object-cover"
            priority={eager}
            fetchPriority={eager ? "high" : "auto"}
          />
        ) : null}
      </div>

      {/* 🔑 **والبابُ لا يُرسم إلّا على مقطعٍ يعمل** (D-743): **الضغطةُ على
          شيءٍ واقفٍ معناها «شغّله» لا «خذني لمكانٍ آخر»** — **وغلافٌ
          شفّافٌ فوق زرِّ التشغيل يسرق أوضحَ نيّةٍ في الواجهة.** */}
      {href && playing ? (
        <Link
          href={href}
          prefetch={false}
          aria-label={openLabel ?? title}
          className="absolute inset-0 z-20"
          onClick={onOpen}
        />
      ) : null}

      {/* ⚠️ **وزرٌّ لا يُرى لا يُعلَن** (D-756): **السطحُ يبقى ملموساً
          ليقع عليه أوّلُ ما يخطر — التشغيل** (D-743)، **وقارئُ الشاشة لا
          يُخبَر بزرٍّ لا صورةَ له.** */}
      {!playing && !dead ? (
        <button
          type="button"
          onClick={startManually}
          aria-label={playLabel}
          aria-hidden={!showsPlayButton}
          tabIndex={showsPlayButton ? 0 : -1}
          className="absolute inset-0 z-30 grid place-items-center"
        >
          {showsPlayButton ? (
            <span className="grid h-14 w-14 place-items-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-sm">
              <Icon name="play" size={26} />
            </span>
          ) : null}
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => onMutedChange(!muted)}
        aria-label={muted ? unmuteLabel : muteLabel}
        className="absolute end-2.5 top-2.5 z-40 grid h-9 w-9 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm transition active:opacity-70"
      >
        <Icon name={muted ? "volume-off" : "volume"} size={17} />
      </button>

      {/* 🔑 **وشريطٌ يُرسم ولا يُضغط يَعِد بما لا يفي** (D-741) — **ومساحةُ
          لمسٍ أعرضُ من الخطّ**، **والرقمُ يقفز في الحال ولا يُنتظر ردُّ
          الإطار.** ⚠️ **و`dir="ltr"`**: **الزمنُ يجري يساراً يميناً في
          كلِّ مشغّلٍ في الدنيا — الشريطُ محورُ وقتٍ لا سطرُ كلام.**
          ⚠️ **و`touch-pan-y` لا `touch-none`** (D-746): **من صادر محوراً
          لا يحتاجه سرق إيماءةَ من حوله.** */}
      {at ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2.5 pt-6">
          <span dir="ltr" className="mb-1.5 block text-12 tabular-nums text-white/90">
            {clock(at.now)} / {clock(at.total)}
          </span>
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
            className="pointer-events-auto -my-2 cursor-pointer touch-pan-y py-2"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              event.currentTarget.setPointerCapture(event.pointerId);
              seek(event.clientX);
            }}
            onPointerMove={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) seek(event.clientX);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") {
                event.preventDefault();
                nudge(5);
              } else if (event.key === "ArrowLeft") {
                event.preventDefault();
                nudge(-5);
              }
            }}
          >
            <span className="block h-[3px] overflow-hidden rounded-full bg-white/25">
              <span
                className="block h-full bg-accent transition-[width] duration-500 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
