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
const TICK_MS = 250;

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

  /* 🔴 D-968 — **حارسُ التعثّر**: مشغّلٌ طُلب منه التشغيلُ ولم يصل `playing` خلال عشر
     ثوانٍ يُعامل كرفض (`fail`): البديلُ التالي ثمّ البابُ الويبيّ — **فلا دوّارةَ أبديّة**
     (ما رآه أحمد على 1.8.2 حين زال الرفضُ وبقي الصمت). المهلةُ من قيمة المنتظَر
     (D-580): أطولُ من أيِّ إقلاعٍ صادق، أقصرُ من صبر مشاهد. */
  const stalled = wantPlay && active && foreground && veiled;
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
  const fail = useCallback((error?: string) => {
    /* D-967: رمزُ الرفض يُكتب في السجلّ — الجهازُ وحدَه يراه (logcat/A0)، والحاويةُ لا تصل يوتيوب */
    if (error) console.warn(`[trailer] youtube rejected ${videoKeys[idx] ?? "?"}: ${error}`);
    setPlaying(false);
    setAt(0);
    if (idx + 1 < videoKeys.length) setIdx(idx + 1);
    else onExhausted();
  }, [idx, onExhausted, videoKeys]);
  failRef.current = () => fail("stalled");

  if (!key) return null;
  const pct = dur > 0 ? Math.max(0, Math.min(1, at / dur)) : 0;

  return (
    <View style={{ width, height, backgroundColor: "#000", overflow: "hidden" }}>
      <Player
        ref={ref}
        height={height}
        width={width}
        videoId={key}
        play={wantPlay && active && foreground}
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
          /* الأدواتُ أدواتُنا، فلا لمسةَ تصل الإطار: التمريرُ والضغطُ للسطح فوقه */
          pointerEvents: "none",
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

      {/* السِّترُ — الصورةُ نفسُها التي كانت على البطاقة، فلا وميضَ عند التحوّل */}
      {veiled ? (
        <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]} pointerEvents="none">
          {poster ? <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" }}>
            {slow && wantPlay ? <ActivityIndicator color="#fff" /> : <Icon name="play" size={24} color="#fff" />}
          </View>
        </View>
      ) : null}

      {/* السطحُ: يُظهر الأدواتِ ولا يوقف (D-771)، والضغطتان تقفزان (D-934) */}
      <Pressable
        style={StyleSheet.absoluteFill}
        accessibilityLabel={`${playing ? t.trailerPause : t.trailerPlay} — ${label}`}
        onPress={(e) => onSurface(e.nativeEvent.locationX)}
      />

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

      {/* شريطُ الأدوات — عائلةُ الأزرار نفسُها: أيقونةٌ واحدةٌ في دائرةٍ داكنة */}
      {controls ? (
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 10, paddingBottom: 8, paddingTop: 14, backgroundColor: "rgba(0,0,0,0.45)" }}>
          <Pressable
            onPress={(e) => onBar(e.nativeEvent.locationX)}
            onLayout={(e) => setBarW(e.nativeEvent.layout.width)}
            hitSlop={10}
            accessibilityLabel={t.trailerSeek}
            style={{ height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.28)", marginBottom: 8 }}
          >
            <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct * 100}%`, borderRadius: 2, backgroundColor: tokens.accent }} />
          </Pressable>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Pressable
              onPress={() => {
                onWantPlay(!wantPlay);
                show();
              }}
              hitSlop={8}
              accessibilityLabel={playing ? t.trailerPause : t.trailerPlay}
            >
              <Icon name={playing ? "pause" : "play"} size={20} color="#fff" />
            </Pressable>
            {/* 🗑️ D-964 — **وزرُّ الصوت خرج من هنا**: صار في الرُكن ظاهراً دائماً،
                **وزرّان لفعلٍ واحدٍ على سطحٍ واحد عطلٌ لا خيار** (القاعدة ٣). */}
            <Text size={12} weight="600" color="#fff" style={{ flex: 1 }}>
              {`${clock(at)} / ${dur > 0 ? clock(dur) : "0:00"}`}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
