import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, BackHandler, Easing, Platform, Pressable, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../api";
import { CONFIG } from "../config";
import { rootsBorn } from "../bootRoot";
import { webLocale } from "../i18n";
import { mark } from "../perfMarks";
import { Icon } from "../icons";
import { Logo } from "../Logo";
import { posterFor } from "../poster";
import { session } from "../session";
import { shell } from "../shell";
import { useApp } from "../state";
import { radius, space } from "../theme";
import { Button, Text } from "../ui";

/**
 * ====== شاشةُ الدخول الأصليّة (D-1344 · Phase 11-U · U1) ======
 *
 * قرارُ أحمد ١ («ابغى احولها اصلية») و٦ («سجل دخول اول»): من لم يدخل يرى هذه الشاشةَ لا صفحةَ الويب، ولا
 * تبويبَ يُفتح قبل الدخول — فلا «تصفّح أوّلاً» هنا.
 *
 * 🔑 **الدخولُ نفسُه لم يتغيّر**: الزرُّ ينادي `shell.signIn()` — وهو ما كانت تناديه رسالةُ `login` من صفحة الويب
 * حرفاً (`WebLayer.doLogin`: Google في المتصفّح ثمّ التسليمُ للويب). ما تغيّر هو الشاشةُ التي فوقه وما يليه:
 * **الشاشةُ تسأل الخادمَ بنفسها «أتمّ الترحيب؟»** برمز الدخول الذي في يدها — فمن أتمّه يهبط على الرئيسيّة الأصليّة
 * مباشرةً (كان يهبط على رئيسيّة الويب بعد كلِّ دخول)، ومن لم يُتمّه تُنزَل الشاشةُ فتظهر طبقةُ الويب بترحيبها
 * (الترحيبُ الأصليُّ المرحلةُ التالية). لا ينتظر أيٌّ منهما أن يُحمَّل الويب.
 *
 * ⚖️ ما سقط عن شاشة الويب بقراره: الشارةُ الإنجليزيّة (القرار ١٣ — النقاطُ الثلاثُ مكانها) و«تصفّح أوّلاً»
 * (القرار ٦). وما بقي: العنوانُ بسطرَيه، وجدارُ الملصقات المتحرّك («متحركة ببطئ مثل الويب») بأشهر الأعمال.
 */

/* ===== جدارُ الملصقات =====
   أربعةُ صفوفٍ تنزلق أفقيّاً ببطء، صفٌّ يميناً وصفٌّ يساراً، مائلةً خلف المحتوى. كلُّ صفٍّ يُرسم مرّتين متتاليتين
   وينزلق بمقدار نسخةٍ واحدة ثمّ يعود — فالحلقةُ بلا قفزة. الحركةُ على الخيط الأصليّ (`useNativeDriver`) فلا
   تمسّ JS. ومن أطفأ الحركةَ في جهازه يراه ثابتاً. `direction: ltr` للجدار وحدَه: زينةٌ لا نصَّ فيها، وحسابُ
   الانزلاق لا يُقلب مع اتّجاه الواجهة. */
const TILE_W = 92;
const TILE_H = 138;
const TILE_GAP = 10;
const ROWS = 4;
const LOOP_MS = 70_000;

function WallRow({ posters, reverse, still }: { posters: string[]; reverse: boolean; still: boolean }) {
  const x = useRef(new Animated.Value(0)).current;
  const span = posters.length * (TILE_W + TILE_GAP);
  useEffect(() => {
    if (still || span === 0) return;
    x.setValue(0);
    const loop = Animated.loop(Animated.timing(x, { toValue: 1, duration: LOOP_MS, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [x, span, still]);
  const translateX = x.interpolate({ inputRange: [0, 1], outputRange: reverse ? [-span, 0] : [0, -span] });
  return (
    <Animated.View style={{ flexDirection: "row", marginBottom: TILE_GAP, transform: [{ translateX }] }}>
      {[...posters, ...posters].map((p, i) => (
        <Image
          key={`${p}-${i}`}
          source={{ uri: posterFor(p, TILE_W) ?? undefined }}
          style={{ width: TILE_W, height: TILE_H, borderRadius: radius.poster, marginRight: TILE_GAP }}
          contentFit="cover"
          transition={400}
        />
      ))}
    </Animated.View>
  );
}

/** `#rrggbb` ⇒ `rgba()` — لستارة الجدار بلون خلفيّة الثيم نفسِه (لا قيمةَ مكتوبةً بيد) */
function withAlpha(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function PosterWall({ posters }: { posters: string[] }) {
  const { tokens } = useApp();
  const { height } = useWindowDimensions();
  const [still, setStill] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => setStill(!!v));
  }, []);
  const rows = useMemo(() => {
    const per = Math.max(1, Math.ceil(posters.length / ROWS));
    return Array.from({ length: ROWS }, (_, r) => {
      const slice = posters.slice(r * per, r * per + per);
      return slice.length >= 3 ? slice : posters.slice(0, per);
    });
  }, [posters]);
  /* ستارةٌ من شرائحَ متدرّجة (لا مكتبةَ تدرّجٍ في التطبيق): شفّافةٌ أعلى الجدار حيث يذوب في الخلفيّة، وأكثفُ أسفلَه
     حيث النقاطُ والزرّ — فالنصُّ يُقرأ والملصقاتُ تُرى. */
  const BANDS = 10;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: height * 0.72, overflow: "hidden" }}>
      <View style={{ position: "absolute", left: -60, right: -60, bottom: -40, opacity: 0.55, transform: [{ rotate: "-6deg" }], direction: "ltr" }}>
        {rows.map((r, i) => (
          <WallRow key={i} posters={r} reverse={i % 2 === 1} still={still} />
        ))}
      </View>
      <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}>
        {Array.from({ length: BANDS }, (_, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: withAlpha(tokens.bg, i === 0 ? 1 : Math.max(0.5, 0.95 - i * 0.07)) }} />
        ))}
      </View>
    </View>
  );
}

const POINTS = [
  { icon: "check-line", key: "signInPoint1" },
  { icon: "calendar", key: "signInPoint2" },
  { icon: "people", key: "signInPoint3" },
] as const;

export function SignInScreen() {
  const { t, tokens, locale } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  /* 🩺 D-1346 — كم بقيت الشاشةُ مرفوعة: إنزالٌ في جزءٍ من الثانية بلا دخولٍ هو العطلُ نفسُه (الخروجُ كان يُنزلها) */
  useEffect(() => {
    const t0 = Date.now();
    return () => mark("signin.hide", Date.now() - t0);
  }, []);
  const [failed, setFailed] = useState(false);

  /* الجدارُ زينة: يُطلب بعد أن تُرسم الشاشة، ولا رمزَ معه (لا جلسةَ بعد)، وسقوطُه يتركها بلا خلفيّة */
  const wall = useQuery({
    queryKey: ["welcome:posters"],
    queryFn: async () => (await api<{ posters: string[] }>("/api/v1/welcome/posters", { auth: false })).data.posters,
    staleTime: 60 * 60_000,
    retry: 0,
  });

  /* رجوعُ النظام يخرج من التطبيق: لا شيءَ خلف هذه الشاشة يُرجَع إليه (طبقةُ الويب تحتها صفحةُ الدخول القديمة) */
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      BackHandler.exitApp();
      return true;
    });
    return () => sub.remove();
  }, []);

  const signIn = useCallback(async () => {
    if (busy) return;
    setFailed(false);
    setBusy(true);
    try {
      const r = await shell.signIn();
      if (!r.ok) {
        /* أغلق نافذةَ Google بنفسه ⇒ لا رسالة؛ غيرُه خطأٌ يُقال */
        if (!r.cancelled) setFailed(true);
        return;
      }
      /* «أتمّ الترحيب؟» برمز الدخول نفسِه — لا ننتظر جلسةً مملوكةً تُسكّ ولا صفحةً تُحمَّل.
         `true` وحدَها تفتح الرئيسيّة: جوابٌ غائبٌ أو فاشلٌ يترك القرارَ للويب (حارسُه يعرف) لا يخمّنه. */
      let onboarded = false;
      try {
        const res = await fetch(`${CONFIG.apiBase}/api/v1/me`, { headers: { Accept: "application/json", Authorization: `Bearer ${r.access}`, "Cache-Control": "no-cache" } });
        const json = (await res.json().catch(() => null)) as { data?: { onboarded?: boolean } | null } | null;
        onboarded = json?.data?.onboarded === true;
      } catch {
        onboarded = false;
      }
      if (onboarded) {
        /* كما يرفعها الإقلاع (`rootsBorn(true)`: رجوعُها يخرج من التطبيق) — والويبُ يُكمل تسليمَه تحتها */
        if (router.canDismiss()) router.dismissAll();
        rootsBorn(true);
        router.push("/home");
        return;
      }
      /* لم يُتمّ (أو لم يُعرف) ⇒ الترحيبُ ما زال ويباً: الشاشةُ تبقى (والزرُّ يدور) حتى تصل صفحةُ الترحيب تحتها —
         لو نزلت الآن لظهرت صفحةُ دخول الويب لحظةً والتسليمُ في الطريق. وصولُها يكتب العلامة (`WebLayer.onNav`)،
         ومستمعُها هناك يُنزل ما فوق الطبقة؛ والمهلةُ حزامٌ لمن لم تصله (شبكةٌ بطيئة، أو حسابٌ أتمّ ولم يُعرف). */
      await new Promise<void>((done) => {
        if (session.welcomePending()) return done();
        const timer = setTimeout(() => {
          off();
          done();
        }, 8000);
        const off = session.onWelcome((on) => {
          if (!on) return;
          clearTimeout(timer);
          off();
          done();
        });
      });
      if (router.canDismiss()) router.dismissAll();
    } finally {
      setBusy(false);
    }
  }, [busy, router]);

  const openDoc = useCallback((path: "/terms" | "/privacy") => {
    /* الصفحتان القانونيّتان تبقيان ويباً (قرارُه ١٠ أكتوبر) — تُفتحان في متصفّح التطبيق المصغَّر: لا جلسةَ تلزمهما.
       🆕 D-1345 — **النسخةُ العارية `/app/…`** لا صفحةُ الموقع: تلك تحمل شريطَه السفليَّ ورابطَ «‹ Loopz»
       فتصفّح منها الموقعَ كلَّه قبل أن يسجّل (تسجيلُه ١٠ أكتوبر). واللغةُ في العنوان: المتصفّحُ المصغَّر
       لا يرى كعكةَ الـWebView، فلا يعرف ما اختاره هنا. */
    void WebBrowser.openBrowserAsync(`${CONFIG.apiBase}/app${path}?lang=${locale}`).catch(() => {});
  }, [locale]);

  const flipLang = useCallback(() => {
    const next = locale === "ar" ? "en" : "ar";
    /* كوكي لغة الويب أوّلاً (صفحةُ الترحيب ما زالت ويباً — تتبع اختيارَه هنا)، ثمّ لغةُ التطبيق: `webLocale.set`
       يحفظها ويعيد تحميلَ التطبيق لأنّ الاتّجاهَ ينقلب (قرارُ إقلاع) — فيعود إلى هذه الشاشة بلغته الجديدة. */
    shell.setWebLang(next);
    webLocale.set(next);
  }, [locale]);

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg, paddingTop: insets.top }}>
      {wall.data && wall.data.length >= 6 ? <PosterWall posters={wall.data} /> : null}

      <View style={{ flexDirection: "row", paddingHorizontal: space.lg, paddingTop: space.md }}>
        <Pressable
          onPress={flipLang}
          disabled={busy}
          hitSlop={8}
          accessibilityRole="button"
          style={{ borderWidth: 1, borderColor: tokens.border, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 6, backgroundColor: tokens.surface }}
        >
          <Text size={12} weight="600" muted>{t.signInOtherLang}</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: space.xl }}>
        <Logo size={84} />
        <Text size={26} weight="800" style={{ textAlign: "center", marginTop: space.xl, lineHeight: 38 }}>{t.landingH1a}</Text>
        <Text size={26} weight="800" color={tokens.accent} style={{ textAlign: "center", lineHeight: 38 }}>{t.landingH1b}</Text>

        <View style={{ alignSelf: "stretch", marginTop: space.xl + space.sm, gap: space.md }}>
          {POINTS.map((p) => (
            <View
              key={p.key}
              style={{ flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.border, borderRadius: radius.card, paddingHorizontal: space.md + 2, paddingVertical: space.md }}
            >
              <View style={{ width: 34, height: 34, borderRadius: radius.control, backgroundColor: withAlpha(tokens.accent, 0.14), alignItems: "center", justifyContent: "center" }}>
                <Icon name={p.icon} size={18} color={tokens.accent} />
              </View>
              <Text size={15} weight="500" style={{ flex: 1 }}>{t[p.key]}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ paddingHorizontal: space.lg + 4, paddingBottom: Math.max(insets.bottom, space.lg) + space.sm }}>
        {failed ? (
          <Text size={13} color={tokens.error} style={{ textAlign: "center", marginBottom: space.md }}>{t.signInFailed}</Text>
        ) : null}
        <Button label={t.loginContinueGoogle} busy={busy} onPress={() => void signIn()} style={{ minHeight: 52 }} />
        {/* كلُّ قطعةٍ `Text` بنصِّها: المكوّنُ يختار الخطَّ لنصٍّ صِرف، وأبٌ فيه نصٌّ وعناصرُ معاً يسقط إلى خطّ النظام */}
        <Text size={12} style={{ textAlign: "center", marginTop: space.md + 2, lineHeight: 20 }}>
          <Text size={12} muted>{t.signInConsentLead}</Text>
          <Text size={12} style={{ textDecorationLine: "underline" }} onPress={() => openDoc("/terms")}>{t.signInConsentTerms}</Text>
          <Text size={12} muted>{t.signInConsentAnd}</Text>
          <Text size={12} style={{ textDecorationLine: "underline" }} onPress={() => openDoc("/privacy")}>{t.signInConsentPrivacy}</Text>
        </Text>
      </View>
    </View>
  );
}
