import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Linking, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import YoutubePlayer, { type YoutubeIframeRef } from "react-native-youtube-iframe";
import type { WebViewProps } from "react-native-webview";
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";
import { useApp } from "../state";
import { CONFIG } from "../config";
import { Text } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";

/**
 * ====== المشغّلُ الأصليُّ الواحد — D-959 (١٤ سبتمبر ٢٠٢٦) ======
 *
 * ⚖️ **نقضٌ مسجَّلٌ لقرار C3** (D-955 · D-958: «التريلراتُ تبقى ويبيّةً، والضغطُ
 * بابٌ») **بأمر أحمد** («نفّذها» بعد أن قرأ حجّتَي المنع). **وما سقط من الحجّتين
 * قبل النقض يُكتب**: (١) «بناءُ EAS أثقل» كانت مبالغة — الرقعةُ تُضيف ٣٤ سطراً
 * إلى `package-lock` (`react-native-youtube-iframe` + `events`) وصفرَ شيفرةٍ
 * أصليّة، فالبناءُ لا يثقُل. (٢) «لا مكسبَ أصليّاً» تبقى صحيحةً تقنيّاً — هذا
 * الملفُّ WebView تحمل iframe يوتيوب كما الباب — **والمكسبُ في مكانٍ آخر**:
 * **لا مغادرةَ للشاشة الأصليّة**، فالصفُّ يبقى تحت الإصبع والرجوعُ بلا جسرٍ ولا
 * `sessionStorage` ولا وميض. **وهذا هو الفرقُ الذي طلبه.**
 *
 * 🔑 **مشغّلٌ واحدٌ لكلِّ الشاشات الأصليّة** (القاعدة ٣): هذا الملفُّ هو المصنع —
 * صفُّ «اكتشف» وصفحةُ العمل ينادانه بالحجج نفسِها. **مشغّلٌ أصليٌّ ثانٍ عطل.**
 *
 * 🔑 **والسلوكُ سلوكُ المشغّل الويبيِّ نفسِه لا اجتهادٌ ثانٍ** — القراراتُ التي
 * دُفع ثمنُها هناك تُنقل حرفاً:
 * - **الواجهةُ الرسميّةُ وحدَها** (D-759): المكتبةُ غلافٌ فوق `YT.Player`
 *   و`onStateChange`/`onError`؛ لا بروتوكولَ رسائلَ يدويّاً.
 * - **سِترٌ حتى يثبت الرسم** (D-759): الملصقُ يغطّي المشغّلَ حتى `playing`
 *   **و`t > 0.1`** — فلا مستطيلَ أسودَ في أيِّ حال.
 * - **البِكرُ يُقلع مكتوماً ثمّ يفكّ كتمَه بنفسه عند أوّل `playing`**
 *   (D-759 + D-771): **بوّابةُ التشغيل الآليِّ الوحيدةُ الموثوقة** — والصوتُ
 *   بعدها هو الافتراض، لا ضغطةَ عليه.
 * - **اللمسُ يُظهر الأدواتِ ولا يوقف** (D-771)، **والأدواتُ تتوارى بعد خمس
 *   ثوانٍ** (D-764)، **والضغطةُ المزدوجة تقفز خمساً** — يميناً تقديمٌ ويساراً
 *   ترجيعٌ **فيزيائيّاً لا لغويّاً** (D-934)، **والثانيةُ لا توقف** (D-882).
 * - **الخطأُ يجرّب البديلَ ثمّ ينتهي بالباب** (D-743/D-759): `videoKeys`
 *   مرتّبةٌ، فإن رفض يوتيوب المفاتيحَ كلَّها فُتح المشغّلُ الويبيُّ في الغلاف —
 *   **الفشلُ يسقط إلى ما كان قبل هذا الملفّ، لا إلى مستطيلٍ ميّت.**
 *
 * ⚠️ **وما لم يُنقل، ويُكتب فجوةً لا يُدَّعى** (D-063): شريطُ مستوى الصوت
 * (D-933) — هنا كتمٌ وفكُّه لا سلّم؛ والتكبيرُ (D-762)؛ واستئنافُ آخرِ موضعٍ بين
 * الجلسات؛ **وتفضيلُ الصوت لا يُحفظ** (كوكي الويب `trailerPrefs` لا يقرؤها
 * الأصليّ) — الكتمُ يعيش للجلسة وحدَها.
 *
 * 🔑 **ولا صفحةَ طرفٍ ثالثٍ في المسار**: المكتبةُ تُحمّل افتراضاً صفحةً على
 * `lonelycpp.github.io` — **`useLocalHTML` يُلغيها**، والمستندُ يُبنى محليّاً
 * **بأصل الموقع نفسِه** (`loopztv.com` — D-967؛ كان `youtube.com` فردّته يوتيوب)،
 * فلا مضيفَ بيننا وبين يوتيوب.
 */

/**
 * 🔴 **واجهةُ المكتبة تُعاد كتابتُها هنا، ولا تُترك `any`**: تعريفُها يقول
 * `React.VFC` **وقد حُذف من `@types/react` ١٩** — فالمترجمُ (بـ`skipLibCheck`
 * الموروثة من `expo/tsconfig.base`) يبتلع الملفَّ ويصير المكوّنُ `any` صامتاً.
 * **ومكوّنٌ بلا نوعٍ خطأٌ مطبعيٌّ لا يظهر إلّا على الجهاز** — فهذه الأسماءُ
 * الاثنا عشرَ التي نستعملها مكتوبةٌ بأيدينا فوق المكتبة نفسِها.
 */
type PlayerState = "unstarted" | "ended" | "playing" | "paused" | "buffering" | "video cued";
type YtProps = {
  height: number;
  width?: number;
  videoId: string;
  play?: boolean;
  mute?: boolean;
  volume?: number;
  useLocalHTML?: boolean;
  baseUrlOverride?: string;
  forceAndroidAutoplay?: boolean;
  initialPlayerParams?: { controls?: boolean; rel?: boolean; iv_load_policy?: number; preventFullScreen?: boolean; loop?: boolean };
  webViewStyle?: StyleProp<ViewStyle>;
  webViewProps?: WebViewProps;
  onReady?: () => void;
  onError?: (error: string) => void;
  onChangeState?: (state: PlayerState) => void;
  ref?: React.Ref<YoutubeIframeRef>;
};
const Player = YoutubePlayer as unknown as React.ComponentType<YtProps>;

/** روابطُ يوتيوب الخارجة من التضمين (شعارٌ · «شاهد على يوتيوب») تُعرف بأصلها */
const YT_ORIGIN = "https://www.youtube.com";
/**
 * 🔴 D-967 — **أصلُ المستند المحلّيّ هو أصلُ الويب نفسُه** (`loopztv.com`) لا يوتيوب.
 * بلاغُ أحمد بتسجيل: «إذا ضغطت على الفيديو يشتغل ويذهب بي إلى صفحة التريلر» —
 * **وما رآه ليس باباً بل سقوطاً**: يوتيوب رفضت المقطعَ داخل التطبيق فجرّب المشغّلُ
 * بدائلَه ثمّ فتح البابَ الويبيّ (`onExhausted`)، **والمقطعُ نفسُه يعمل في الويب.**
 * الفرقُ الوحيدُ بين الحالتين هو المُحيل: مستندٌ يدّعي أصلَ `youtube.com` ولا يُخدَم
 * منها يصل يوتيوب بلا مُحيلٍ صادق فتردّه («configuration error» 153)، **ومستندٌ
 * بأصل الموقع يصلها كما تصلها صفحةُ التريلرات التي تعمل.** فالمرجعُ ما ثبت لا ما
 * افتُرض (D-145).
 */
const DOC_ORIGIN = CONFIG.apiBase;
/** D-934: القفزةُ خمسُ ثوانٍ، والضغطتان خلال ٣٢٠ م.ث على الجهة نفسِها */
const SEEK_STEP = 5;
const DOUBLE_TAP_MS = 320;
const BADGE_MS = 700;
/** D-764: الأدواتُ تتوارى بعد خمس ثوانٍ من التشغيل */
const CONTROLS_IDLE_MS = 5000;
/** D-968: مهلةُ التعثّر — تشغيلٌ مطلوبٌ بلا `playing` بعدها يُعامل كرفض */
const STALL_MS = 10_000;
/** D-982 — قطرُ ثقب الإيقاظ في السطح الخامل (أيقونةُ التشغيل ٥٦ وما حولها) */
const WAKE_HOLE = 96;
const TICK_MS = 250;
/** D-1041 — مهلةُ البدء التلقائيّ بعد تبديل المقطع في المكان: أقصرُ كثيراً من حارس التعثّر (١٠ث) فيسبقه */
const AUTO_GRACE_MS = 3000;

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function TrailerPlayer({
  videoKeys,
  width,
  poster,
  active = true,
  label,
  wantPlay,
  onWantPlay,
  muted,
  onMuted,
  onExhausted,
  idle = false,
  onWake,
  overlay = false,
  onAutoRefused,
}: {
  /** بدائلُ المقطع مرتّبةً (D-743) — الأوّلُ هو المعروض، وما بعده يُجرَّب عند الرفض */
  videoKeys: readonly string[];
  width: number;
  /** الملصقُ/الخلفيّةُ سِتراً حتى يثبت الرسم — نفسُ الصورة التي كانت على البطاقة، فلا وميضَ عند التحوّل */
  poster: string | null;
  /** `false` حين تخرج البطاقةُ من العين أو تفقد الشاشةُ التركيز — يوقف بلا هدم */
  active?: boolean;
  /** اسمُ العمل — لتسميةِ السطح لقارئ الشاشة */
  label: string;
  /**
   * 🔴 **الرغبةُ والكتمُ يسكنان فوق هذا المكوّن** (D-964، بلاغُ أحمد: «إذا وقفت
   * الفيديو ونزلت تحت ثمّ رجعت فوق أشوفه يشتغل مرّة أخرى»): كانا حالةً داخليّةً
   * هنا، **وحالةٌ داخليّةٌ تموت مع أوّل إعادة تركيب** — والصفُّ يُعيد تركيبَ
   * بطاقتِه حين تخرج من الشجرة وتعود (تدويرُ `FlatList` وقصُّ أندرويد)، فتعود
   * القيمةُ الافتراضيّةُ «شغِّل» **فيستأنف ما أوقفه صاحبُه.**
   * 🔑 **فالقاعدة: الرغبةُ تُحفظ حيث لا تُهدم** — في الصفِّ الذي يملك «مَن يعمل»
   * (أو في الشاشة) — **وهذا المكوّنُ يُنفّذ ولا يتذكّر.**
   */
  wantPlay: boolean;
  onWantPlay: (next: boolean) => void;
  muted: boolean;
  onMuted: (next: boolean) => void;
  /** كلُّ المفاتيح رُفضت — يُفتح المشغّلُ الويبيُّ في الغلاف كما قبل D-959 */
  onExhausted: () => void;
  /**
   * 🔥 D-971 — **مشغّلٌ مُحمًّى بلا تشغيل** (بلاغُ أحمد بتسجيل: «الفيديو أبغاه يشتغل
   * أسرع — من الخارج نفسه»): الصفُّ يركّب البطاقةَ الظاهرةَ مسبقاً مكتومةً متوقّفة
   * — فيمرّ تحميلُ WebView وواجهةِ يوتيوب وتهيئةُ المقطع قبل أن يضغط أحد، **وتصير
   * الضغطةُ «شغِّل» لا «حمِّل»** (وصفةُ `TrailerPlaybackController` الويب: البطاقةُ
   * الظاهرة ≥ ٦٠٪ نشطة). في الخمول: السِّترُ وحدَه، لا أدواتَ ولا زرَّ صوت، واللمسةُ
   * تُوقظ (`onWake`) — ما يراه القارئُ هو المصغّرةُ نفسُها التي كانت.
   */
  idle?: boolean;
  onWake?: () => void;
  /** D-987 — المشغّلُ طبقةٌ فوق مصغّرةٍ ثابتة في البطاقة: يُوضع فوقها بلا خلفيّةٍ سوداء ولا سِترٍ من صورة */
  overlay?: boolean;
  /**
   * 🆕 D-1041 — **المقطعُ تبدّل في المكان ولم يبدأ وحدَه**: الصفُّ صار مشغّلاً واحداً تتبدّل مفاتيحُه
   * (`loadVideoById`) بدل مشغّلٍ لكلِّ بطاقة. المستندُ الذي لُمس مرّةً يأذن له المتصفّحُ بما بعدها — لكنّ
   * يوتيوب خدعنا مرّتين (D-968 · D-1010)، فلا وعدَ هنا: إن لم يصل `playing` خلال `AUTO_GRACE_MS` يُبلَّغ
   * الصفُّ فيعيد البطاقةَ خاملةً بـ▶ (ما يعمل اليوم) — **لا سلسلةَ بدائل ولا بابَ ويب لرفضٍ ليس خطأً.**
   */
  onAutoRefused?: () => void;
}) {
  const { t, tokens } = useApp();
  const ref = useRef<YoutubeIframeRef | null>(null);
  const height = Math.round((width * 9) / 16);

  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  /** البِكرُ مكتومٌ حتى أوّل `playing` (D-759)، ثمّ الصوتُ هو الافتراض (D-771).
      **وهذه وحدَها تبقى محلّيّةً**: كلُّ إطارٍ جديدٍ بوّابتُه من جديد. */
  const [primed, setPrimed] = useState(false);
  const [at, setAt] = useState(0);
  const [dur, setDur] = useState(0);
  const [controls, setControls] = useState(true);
  const [poke, setPoke] = useState(0);
  const [badge, setBadge] = useState<"ff" | "rw" | null>(null);
  /* عدّادُ القفزات — الشارةُ تعيش ٧٠٠ م.ث لكلِّ قفزةٍ **وإن تكرّرت الجهةُ نفسُها** */
  const [seq, setSeq] = useState(0);
  const [barW, setBarW] = useState(0);
  /* D-984 — «ميت»: خاملٌ رفضه يوتيوب؛ يُعرَّف هنا مع أخواته لأنّ تبديلَ المقطع (D-1041) يصفّره */
  const [dead, setDead] = useState(false);
  const tap = useRef<{ at: number; right: boolean } | null>(null);

  const key = videoKeys[idx] ?? videoKeys[0] ?? "";
  /* السِّترُ يُرفع بشرطين معاً — `playing` وحدَها تسبق أوّلَ إطارٍ متحرّك */
  const veiled = !(playing && at > 0.1);

  /* العدّادُ من الواجهة الرسميّة في مؤقّتٍ واحد (D-759: لا رسائلَ يدويّة) */
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const p = ref.current;
      if (!p) return;
      p.getCurrentTime().then(setAt).catch(() => {});
      p.getDuration()
        .then((d) => setDur((prev) => (d > 0 && d !== prev ? d : prev)))
        .catch(() => {});
    }, TICK_MS);
    return () => clearInterval(id);
  }, [playing]);

  /* D-764: خمسُ ثوانٍ من آخر لمسةٍ ثمّ تتوارى — وكلُّ لمسةٍ تُعيد العدّ */
  useEffect(() => {
    if (!playing) {
      setControls(true);
      return;
    }
    const id = setTimeout(() => setControls(false), CONTROLS_IDLE_MS);
    return () => clearTimeout(id);
  }, [playing, poke]);

  useEffect(() => {
    if (seq === 0) return;
    const id = setTimeout(() => setBadge(null), BADGE_MS);
    return () => clearTimeout(id);
  }, [seq]);

  /* الخلفيّةُ توقف، والعودةُ تستأنف بالصوت (D-771) — رغبةُ المستخدم لا تُمسّ */
  const [foreground, setForeground] = useState(true);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => setForeground(s === "active"));
    return () => sub.remove();
  }, []);

  /* D-764: مؤشّرُ التحميل بعد ٣٥٠ م.ث لا قبلها — وميضُ دوّارةٍ على مقطعٍ سريعٍ ضجيج */
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!veiled) {
      setSlow(false);
      return;
    }
    const id = setTimeout(() => setSlow(true), 350);
    return () => clearTimeout(id);
  }, [veiled, idx]);

  /* 🆕 D-1041 — **تبديلُ المقطع في المكان**: المشغّلُ نفسُه يبقى (مستندُه وإذنُ لمسته وكتمُه المفكوك)،
     وحالُ المقطع وحدَها تُصفَّر — فيعود السِّترُ (`at = 0`) وتظهر مصغّرةُ البطاقة الجديدة تحته بلا إطارٍ
     أسود (عقدُ D-987). المكتبةُ هي من ينادي `loadVideoById` حين يتبدّل `videoId`. */
  const clip = videoKeys[0] ?? "";
  const firstClip = useRef(true);
  const playingRef = useRef(false);
  playingRef.current = playing;
  const idleRef = useRef(idle);
  idleRef.current = idle;
  const refusedRef = useRef(onAutoRefused);
  refusedRef.current = onAutoRefused;
  useEffect(() => {
    if (firstClip.current) {
      firstClip.current = false;
      return;
    }
    setIdx(0);
    setAt(0);
    setDur(0);
    setPlaying(false);
    setDead(false);
    setControls(true);
    if (idleRef.current) return;
    const id = setTimeout(() => {
      if (!playingRef.current && !idleRef.current) refusedRef.current?.();
    }, AUTO_GRACE_MS);
    return () => clearTimeout(id);
  }, [clip]);

  /* 🔴 D-968 — **حارسُ التعثّر**: مشغّلٌ طُلب منه التشغيلُ ولم يصل `playing` خلال عشر
     ثوانٍ يُعامل كرفض (`fail`): البديلُ التالي ثمّ البابُ الويبيّ — **فلا دوّارةَ أبديّة**
     (ما رآه أحمد على 1.8.2 حين زال الرفضُ وبقي الصمت). المهلةُ من قيمة المنتظَر
     (D-580): أطولُ من أيِّ إقلاعٍ صادق، أقصرُ من صبر مشاهد. */
  const stalled = !idle && wantPlay && active && foreground && veiled;
  const failRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (!stalled) return;
    const id = setTimeout(() => failRef.current(), STALL_MS);
    return () => clearTimeout(id);
  }, [stalled, idx]);

  const show = useCallback(() => setPoke((n) => n + 1), []);

  const onSurface = useCallback(
    (x: number) => {
      const right = x > width / 2;
      const now = Date.now();
      const prev = tap.current;
      tap.current = { at: now, right };
      /* الأولى تبقى ضغطةً تكشف الأدوات، والثانيةُ على الجهة نفسِها قفزةٌ لا إيقاف (D-934) */
      if (prev && now - prev.at < DOUBLE_TAP_MS && prev.right === right && playing) {
        const to = Math.max(0, at + (right ? SEEK_STEP : -SEEK_STEP));
        ref.current?.seekTo(to, true);
        setAt(to);
        setBadge(right ? "ff" : "rw");
        setSeq((n) => n + 1);
        return;
      }
      setControls(true);
      show();
    },
    [at, playing, show, width],
  );

  const onBar = useCallback(
    (x: number) => {
      if (!dur || !barW) return;
      /* الشريطُ فيزيائيٌّ لا لغويّ: يمتلئ من اليسار في الاتّجاهين (D-934/D-878) */
      const to = Math.max(0, Math.min(dur, (x / barW) * dur));
      ref.current?.seekTo(to, true);
      setAt(to);
      show();
    },
    [barW, dur, show],
  );

  /* البديلُ التالي في المكان، فإن نفدت السلسلةُ فالبابُ الويبيّ (D-743).
     **والقرارُ خارجَ مُحدِّث الحالة عمداً**: مُحدِّثٌ يُنادى مرّتين في وضع
     التطوير الصارم يفتح البابَ مرّتين. */
  /* 🔴 D-984 — **الخاملُ الذي رُفض لا يفتح باباً** (بلاغُ أحمد بتسجيل على 1.8.6: «إذا
     دخلت اكتشف مباشرةً يدخلني على التريلرات»): D-971 تحمّي البطاقةَ الأولى بلا ضغطة،
     فإن ردّها يوتيوب (خطأ تضمين) سقطت إلى `onExhausted` وفُتحت صفحةُ الويب **من تلقاء
     نفسها** فوق ما كان المستخدمُ يفعله — حتى فوق ضغطته على الشريط السفليّ. البابُ فعلُ
     مستخدمٍ لا فعلُ مشغّل: الخاملُ المرفوض يصير «ميتاً» — صورةٌ وأيقونةُ ▶ كما كان،
     **واللمسةُ عليه هي التي تفتح الباب.** */
  const fail = useCallback((error?: string) => {
    /* D-967: رمزُ الرفض يُكتب في السجلّ — الجهازُ وحدَه يراه (logcat/A0)، والحاويةُ لا تصل يوتيوب */
    if (error) console.warn(`[trailer] youtube rejected ${videoKeys[idx] ?? "?"}: ${error}`);
    setPlaying(false);
    setAt(0);
    if (idx + 1 < videoKeys.length) setIdx(idx + 1);
    else if (idle) setDead(true);
    else onExhausted();
  }, [idx, idle, onExhausted, videoKeys]);
  useEffect(() => {
    setDead(false);
  }, [videoKeys]);
  failRef.current = () => fail("stalled");

  if (!key) return null;
  const pct = dur > 0 ? Math.max(0, Math.min(1, at / dur)) : 0;

  return (
    <View style={overlay ? { position: "absolute", top: 0, left: 0, width, height, overflow: "hidden" } : { width, height, backgroundColor: "#000", overflow: "hidden" }}>
      {dead ? null : (
      <Player
        ref={ref}
        height={height}
        width={width}
        videoId={key}
        play={!idle && wantPlay && active && foreground}
        mute={muted || !primed}
        volume={100}
        useLocalHTML
        baseUrlOverride={DOC_ORIGIN}
        /* 🔴 D-968 — **الرفضُ زال (D-967) والتشغيلُ لم يبدأ**: بلاغُ أحمد بتسجيل على 1.8.2
           «الفيديو ما يشتغل — 0:00 / 2:09 ودوّارة». المدّةُ وصلت فالتضمينُ مقبول، لكنّ
           `playVideo()` من غير لمسةٍ لا يُنفَّذ في WebView أندرويد **بواجهة مستخدمٍ محمولة**
           — يوتيوب تمنع التشغيلَ البرمجيَّ على الجوّال. والعلاجُ الموثَّق في المكتبة نفسِها:
           واجهةُ سطح مكتبٍ للإطار (`forceAndroidAutoplay`) — **لا اجتهادٌ ثانٍ** (D-145). */
        forceAndroidAutoplay
        initialPlayerParams={{ controls: false, rel: false, iv_load_policy: 3, preventFullScreen: true }}
        webViewStyle={{ opacity: veiled ? 0 : 1, backgroundColor: "#000" }}
        webViewProps={{
          /* الأدواتُ أدواتُنا، فلا لمسةَ تصل الإطار: التمريرُ والضغطُ للسطح فوقه.
             🔴 D-982 — **إلّا في الخمول**: أوّلُ لمسةٍ تمرّ إلى الإطار نفسِه (انظر الثقبَ في
             السطح أدناه) فيتلقّى يوتيوب لمسةً حقيقيّةً ويشغّل بنفسه — `playVideo()`
             البرمجيّ بلا لمسةٍ في مستنده يبقى «جاهزاً» عند 0:00 مهما تنكّرنا (D-968 لم تكفِ؛
             بلاغُ أحمد بتسجيل على 1.8.6: المدّةُ ظهرت والدوّارُ بقي ثمّ بابُ الويب — وهناك عمل من
             أوّل ثانية لأنّ ضغطتَه وصلت المستند). */
          pointerEvents: idle ? "auto" : "none",
          androidLayerType: "hardware",
          setSupportMultipleWindows: false,
          /* رابطٌ خارجَ التضمين (شعارُ يوتيوب أو «شاهد على يوتيوب») يخرج للمتصفّح لا يبتلع الشاشة */
          onShouldStartLoadWithRequest: (req: ShouldStartLoadRequest) => {
            const url = req.url ?? "";
            if (!url || url === "about:blank" || req.isTopFrame === false) return true;
            /* D-967: المستندُ نفسُه يحمل أصلَ الموقع — تحميلُه ليس خروجاً */
            if (url.startsWith(DOC_ORIGIN)) return true;
            if (url.startsWith(YT_ORIGIN)) {
              if (url.includes("/watch") || url.includes("/channel/") || url.includes("/@")) {
                Linking.openURL(url).catch(() => {});
                return false;
              }
              return true;
            }
            Linking.openURL(url).catch(() => {});
            return false;
          },
        }}
        onReady={() => {
          ref.current?.getDuration().then((d) => d > 0 && setDur(d)).catch(() => {});
        }}
        onError={fail}
        onChangeState={(s: PlayerState) => {
          /* D-982 — يوتيوب بدأ من لمسةٍ وصلته وهو خامل: البطاقةُ استيقظت */
          if (idle && (s === "playing" || s === "buffering")) onWake?.();
          if (s === "playing") {
            setPlaying(true);
            /* أوّلُ `playing` يفكّ الكتمَ من نفسه — لا ضغطةَ على الصوت (D-771) */
            setPrimed(true);
            return;
          }
          if (s === "paused") {
            setPlaying(false);
            return;
          }
          if (s === "ended") {
            /* النهايةُ تعيده إلى البداية بسِترِه — لا تكرارَ ذاتيّاً ولا مستطيلٌ أسود */
            setPlaying(false);
            onWantPlay(false);
            setAt(0);
            ref.current?.seekTo(0, true);
          }
        }}
      />
      )}

      {/* السِّترُ — الصورةُ نفسُها التي كانت على البطاقة، فلا وميضَ عند التحوّل */}
      {veiled ? (
        <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]} pointerEvents="none">
          {poster && !overlay ? <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" }}>
            {slow && wantPlay && !idle && !dead ? <ActivityIndicator color="#fff" /> : <Icon name="play" size={24} color="#fff" />}
          </View>
        </View>
      ) : null}

      {/* السطحُ: يُظهر الأدواتِ ولا يوقف (D-771)، والضغطتان تقفزان (D-934).
          D-982 — في الخمول للسطح **ثقبٌ** في وسطه بقدر أيقونة التشغيل وما حولها (٩٦): اللمسةُ
          فيه تسقط إلى الإطار فيشغّل يوتيوب بلمسةٍ حقيقيّة؛ وما حول الثقب يبقى سطحَنا فلا
          يبتلع الإطارُ تمريرَ الصفحة (تمريرٌ يبدأ فوق الإطار لا يصل إلى `ScrollView`). */}
      {idle ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {(() => {
            const hole = WAKE_HOLE;
            const l = Math.max(0, (width - hole) / 2);
            const tp = Math.max(0, (height - hole) / 2);
            const a11y = `${t.trailerPlay} — ${label}`;
            /* الميتُ يفتح البابَ بلمسةٍ — لا من نفسه (D-984) */
            const wake = () => (dead ? onExhausted() : onWake?.());
            return (
              <>
                <Pressable style={{ position: "absolute", left: 0, right: 0, top: 0, height: tp }} onPress={wake} accessibilityLabel={a11y} />
                <Pressable style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: Math.max(0, height - tp - hole) }} onPress={wake} accessibilityLabel={a11y} />
                <Pressable style={{ position: "absolute", left: 0, top: tp, width: l, height: hole }} onPress={wake} accessibilityLabel={a11y} />
                <Pressable style={{ position: "absolute", right: 0, top: tp, width: l, height: hole }} onPress={wake} accessibilityLabel={a11y} />
                {dead ? <Pressable style={{ position: "absolute", left: l, top: tp, width: hole, height: hole }} onPress={wake} accessibilityLabel={a11y} /> : null}
              </>
            );
          })()}
        </View>
      ) : (
        <Pressable
          style={[StyleSheet.absoluteFill, { elevation: 6, zIndex: 6 }]}
          accessibilityLabel={`${playing ? t.trailerPause : t.trailerPlay} — ${label}`}
          onPress={(e) => onSurface(e.nativeEvent.locationX)}
        />
      )}
      {idle ? null : (
      /* 🔴 D-1016 — **الأدواتُ فوق الـWebView بالارتفاع لا بالترتيب** (بلاغُ أحمد بتسجيل على
         1.9.3: «ما أقدر أوقف الفيديو أو أحطّ ميوت»): منذ D-987 صار المشغّلُ طبقةً فوق
         المصغّرة، وعلى أندرويد **يُرسم الـWebView الأصليُّ فوق كلِّ ما يليه من طبقات JS ما لم
         يُرفع بارتفاعٍ صريح** — فالأزرارُ تُرسم (نراها) ولا تصلها اللمسة. `elevation`
         و`zIndex` على طبقة الأدوات يرفعانها فوقه حقّاً. */
      <View style={[StyleSheet.absoluteFill, { elevation: 8, zIndex: 8 }]} pointerEvents="box-none">
      <>

      {/* 🔇 **زرُّ الصوت في رُكن السطح** (D-964، طلبُ أحمد بلقطةٍ معلَّمةٍ على الرُكن
          الأعلى): **لا يتوارى مع شريط الأدوات** (D-764) — **والكتمُ فعلٌ عاجلٌ
          يُطلب حين يفاجئك الصوت، فزرٌّ يحتاج لمسةً تُظهره أوّلاً وصل بعد فوات
          الحاجة.** والرُكنُ فيزيائيٌّ (`right`) كما وسمه في اللقطة، والدائرةُ
          ٣٢ بمساحة لمسٍ ٤٤ بـ`hitSlop` (D-033). */}
      <Pressable
        onPress={() => onMuted(!muted)}
        hitSlop={10}
        accessibilityLabel={muted ? t.trailerUnmute : t.trailerMute}
        style={{ position: "absolute", top: 8, right: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" }}
      >
        <Icon name={muted ? "volume-off" : "volume"} size={17} color="#fff" />
      </Pressable>

      {badge ? (
        <View pointerEvents="none" style={{ position: "absolute", top: 0, bottom: 0, left: badge === "rw" ? 0 : undefined, right: badge === "ff" ? 0 : undefined, width: width / 2, alignItems: "center", justifyContent: "center" }}>
          <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: "rgba(0,0,0,0.6)" }}>
            <Text size={13} weight="700" color="#fff">{badge === "ff" ? `+${SEEK_STEP}` : `−${SEEK_STEP}`}</Text>
          </View>
        </View>
      ) : null}

      {/* 🔴 D-1042 — **⏯ كبيرٌ في الوسط** (بلاغُ أحمد بتسجيل على 1.11.0: «لا أستطيع إيقاف الفيديو إذا ضغطت
          من المنتصف أو حتّى من اليسار تحت»). التشخيص: زرُّ الصوت يعمل (بكلمته) **فالطبقةُ تصلها اللمسة** وD-1016
          سليمة، وأمرا الإيقاف والكتم يسلكان مسارَ المكتبة نفسَه — فالعطلُ في **الزرّ**: أيقونةٌ ٢٠ بهامش ٨ = هدفٌ
          ٣٦ (دون الـ٤٤ — D-033) محشورٌ في زاويةٍ مدوّرة تحت شريطٍ هامشُ لمسه ١٠ إلى الأسفل، فاللمسةُ تُقرأ «قفزة»
          لا «إيقاف». الآن الهدفُ ٥٦ في الوسط حيث ضغط هو، **وهو قاعدةُ الويب حرفاً: «اللمسةُ التي ترى ⏸ توقف»**
          (D-878/D-882 في `TrailerCardMedia`) — اللمسةُ الأولى ما زالت تكشف ولا توقف (D-771)، والضغطتان على
          الجانبين تقفزان (D-934)؛ الدائرةُ دائرةُ ▶ الخاملة نفسُها (٥٦ · `rgba(0,0,0,0.6)`). */}
      {controls ? (
        <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
          <Pressable
            onPress={() => {
              onWantPlay(!wantPlay);
              show();
            }}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={playing ? t.trailerPause : t.trailerPlay}
            /* تحت السِّتر (متوقّفٌ أو يُحمَّل) الدائرةُ مرسومةٌ أصلاً في السِّتر بـ▶ أو دوّارة — فهذا الزرُّ هناك
               **هدفُ لمسٍ شفّافٌ فوقها** لا دائرةٌ ثانية؛ وفوق الفيديو الظاهر يرسم دائرتَه بـ⏸ */
            style={({ pressed }) => ({ width: 56, height: 56, borderRadius: 28, backgroundColor: veiled ? "transparent" : "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", opacity: pressed ? 0.75 : 1 })}
          >
            {veiled ? null : <Icon name={playing ? "pause" : "play"} size={24} color="#fff" />}
          </Pressable>
        </View>
      ) : null}

      {/* شريطُ الأدوات — عائلةُ الأزرار نفسُها: أيقونةٌ واحدةٌ في دائرةٍ داكنة */}
      {controls ? (
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 10, paddingBottom: 8, paddingTop: 14, backgroundColor: "rgba(0,0,0,0.45)" }}>
          <Pressable
            onPress={(e) => onBar(e.nativeEvent.locationX)}
            onLayout={(e) => setBarW(e.nativeEvent.layout.width)}
            /* D-1042 — الهامشُ إلى الأعلى وحدَه: كان ١٠ في كلِّ الجهات فيبتلع ما تحته */
            hitSlop={{ top: 12, bottom: 2, left: 0, right: 0 }}
            accessibilityLabel={t.trailerSeek}
            style={{ height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.28)", marginBottom: 8 }}
          >
            <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct * 100}%`, borderRadius: 2, backgroundColor: tokens.accent }} />
          </Pressable>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            {/* 🗑️ D-1042 — **زرُّ ⏸ الصغير خرج من هنا إلى وسط السطح** (أدناه): زرّان لفعلٍ واحدٍ على سطحٍ واحد
                عطلٌ لا خيار (القاعدة ٣ — وهي التي أخرجت زرَّ الصوت في D-964). */}
            <Text size={12} weight="600" color="#fff" style={{ flex: 1 }}>
              {`${clock(at)} / ${dur > 0 ? clock(dur) : "0:00"}`}
            </Text>
          </View>
        </View>
      ) : null}
      </>
      </View>
      )}
    </View>
  );
}
